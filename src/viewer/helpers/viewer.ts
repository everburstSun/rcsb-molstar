/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Joan Segura <joan.segura@rcsb.org>
 */

import { StructureRef } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy-state';
import { Structure } from 'molstar/lib/mol-model/structure/structure';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { ColorName, ColorNames } from 'molstar/lib/mol-util/color/names';
import { StructureRepresentationRegistry } from 'molstar/lib/mol-repr/structure/registry';
import { StructureSelectionQuery } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { CreateBoundingBox } from "./shapes/behavior";
import {
    SelectBase,
    SelectRange,
    SelectTarget,
    Target,
    targetToLoci,
    targetsToExpression,
    expressionToLoci
} from './selection';


function analyzeTargets(targets: SelectBase | SelectTarget | SelectTarget[]): Target[] {
    const targetArray = Array.isArray(targets) ? targets : [targets];
    const result: Target[] = [];

    for (const target of targetArray) {
        const seqIdKey = 'labelSeqId' in target ? 'labelSeqId' : 'authSeqId';
        const asymIdKey = 'labelAsymId' in target ? 'labelAsymId' : 'authAsymId';
        const seqIds = Array.isArray((target as any)[seqIdKey]) ? (target as any)[seqIdKey] : [(target as any)[seqIdKey]];
        for (const seqId of seqIds) {
            const resultItem: any = {
                modelId: target.modelId,
                operatorName: target.operatorName,
            };
            resultItem[asymIdKey] = (target as any)[asymIdKey];
            if (typeof seqId === 'number') {
                resultItem[seqIdKey] = seqId;
            } else if (typeof seqId === 'string') {
                const pdbxInsCode = seqId.slice(-1);
                const seqIdNumber = Number(seqId.slice(0, -1));
                resultItem[seqIdKey] = seqIdNumber;
                resultItem.pdbxInsCode = pdbxInsCode;
            }
            result.push(resultItem);
        }
    }

    return result;
}

export function setFocusFromTargets(plugin: PluginContext, targets: SelectBase | SelectTarget | SelectTarget[], focus = false) {
    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, Array.isArray(targets) ? targets[0] : targets);
    if (!data) return;

    const analyzedTargets = analyzeTargets(targets)
    const expression = targetsToExpression(analyzedTargets);
    
    const loci = expressionToLoci(expression, data);
    if (!loci) return;

    plugin.managers.camera.focusLoci(loci);
    if (focus) plugin.managers.structure.focus.setFromLoci(loci);
}

export function setFocusFromRange(plugin: PluginContext, target: SelectRange) {
    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, target);
    if (!data) return;

    const loci = targetToLoci(target, data);
    if (!loci) return;

    plugin.managers.structure.focus.setFromLoci(loci);
}

function getStructureWithModelId(structures: StructureRef[], target: { modelId: string }): Structure | undefined {
    if (!target || !target.modelId) return undefined;
    
    const structureRef = getStructureRefWithModelId(structures, target);
    if (structureRef) return structureRef.cell?.obj?.data;
}

export function getStructureRefWithModelId(structures: StructureRef[], target: { modelId: string }): StructureRef | undefined {
    for (const structure of structures) {
        if (!structure.cell?.obj?.data?.units) continue;

        const unit = structure.cell.obj.data.units[0];
        if (unit.model.id === target.modelId) return structure;
    }
}

export function select(plugin: PluginContext, targets: SelectTarget | SelectTarget[], mode: 'select' | 'hover', modifier: 'add' | 'set') {
    if (modifier === 'set')
        clearSelection(plugin, mode);

    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, Array.isArray(targets) ? targets[0] : targets);
    if (!data) return;
    const analyzedTargets = analyzeTargets(targets);
    const expression = targetsToExpression(analyzedTargets);
    
    const loci = expressionToLoci(expression, data);
    if (mode === 'hover') {
        plugin.managers.interactivity.lociHighlights.highlight({ loci });
    } else if (mode === 'select') {
        plugin.managers.structure.selection.fromLoci('add', loci);
    }
}

export function clearSelection(plugin: PluginContext, mode: 'select' | 'hover', target?: { modelId: string; } & Target) {
    if (mode === 'hover') {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }

    if (!target) {
        plugin.managers.interactivity.lociSelects.deselectAll();
        return;
    }

    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, target);
    if (!data) return;

    const loci = targetToLoci(target, data);
    plugin.managers.interactivity.lociSelects.deselect({ loci });
}

export async function createComponent(plugin: PluginContext, componentLabel: string, targets: SelectBase | SelectTarget | SelectTarget[], representationType: StructureRepresentationRegistry.BuiltIn) {
    const structureRef = getStructureRefWithModelId(plugin.managers.structure.hierarchy.current.structures, Array.isArray(targets) ? targets[0] : targets);
    if (!structureRef) throw Error('createComponent error: model not found');

    const analyzedTargets = analyzeTargets(targets);
    const expression = targetsToExpression(analyzedTargets);
    const sel = StructureSelectionQuery('innerQuery_' + Math.random().toString(36).substring(2), expression);
    await plugin.managers.structure.component.add({
        selection: sel,
        options: { checkExisting: false, label: componentLabel },
        representation: representationType,
    }, [structureRef]);
}

export async function removeComponent(plugin: PluginContext, componentLabel: string) {
    const out: Promise<void>[] = [];
    plugin.managers.structure.hierarchy.currentComponentGroups.forEach(c => {
        for (const comp of c) {
            if (comp.cell.obj?.label === componentLabel) {
                const o = plugin.managers.structure.hierarchy.remove(c);
                if (o) out.push(o);
                break;
            }
        }
    });
    await Promise.all(out);
}

export async function createBoundingBox(plugin: PluginContext, label: string, min: number[], max: number[], radius: number, color: ColorName) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'BBGroup' })
    shapesGroup.apply(CreateBoundingBox, {
        min: min,
        max: max,
        label: label,
        radius: radius,
        color: ColorNames[color]
    })
    await structure.commit();
    return shapesGroup.ref;
}

