/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Joan Segura <joan.segura@rcsb.org>
 */

import { StructureRef } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy-state';
import { Structure } from 'molstar/lib/mol-model/structure/structure';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { ColorName, ColorNames } from 'molstar/lib/mol-util/color/names';
import { StructureSelectionQuery } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { BasicCylinderProps } from "molstar/lib/mol-geo/geometry/mesh/builder/cylinder";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { CreateBoundingBox, CreateSphere, CreateCylinder, CreatePlane, CreateAxes, CreateEllipsoid, CreateRibbon, CreateSheet, CreateTube } from "./shapes/behavior";
import { createStructureRepresentationParams } from 'molstar/lib/mol-plugin-state/helpers/structure-representation-params'
import { StructureMeasurementManagerState } from 'molstar/lib/mol-plugin-state/manager/structure/measurement'
import { MeasurementType } from '../types';
import {
    // SelectBase,
    SelectRange,
    SelectTarget,
    Target,
    targetToLoci,
    targetsToExpression,
    expressionToLoci,
    addLociToTargets
} from './selection';


function analyzeTargets(targets: SelectTarget[]): Target[] {
    const result: Target[] = [];

    for (const target of targets) {
        const seqIdKey = target.auth ? 'authSeqId' : 'labelSeqId';
        const asymIdKey = target.auth ? 'authAsymId' : 'labelAsymId';

        const resultItem: any = {
            modelId: target.modelId,
            operatorName: target.operatorName,
        };

        if (seqIdKey in target && (target as any)[seqIdKey] !== undefined) {
            resultItem[seqIdKey] = (target as any)[seqIdKey];
        }
        if (asymIdKey in target && (target as any)[asymIdKey] !== undefined) {
            resultItem[asymIdKey] = (target as any)[asymIdKey];
        }
        if ('pdbxInsCode' in target && (target as any).pdbxInsCode !== undefined) {
            resultItem.pdbxInsCode = (target as any).pdbxInsCode;
        }
        if ('atomIndex' in target && (target as any).atomIndex !== undefined) {
            resultItem.atomIndex = (target as any).atomIndex;
        }

        result.push(resultItem);
    }

    return result;
}

export function setFocusFromTargets(plugin: PluginContext, targets: SelectTarget[], focus = false) {
    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, targets[0]);
    if (!data) return;

    const analyzedTargets = analyzeTargets(targets);
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

export function select(plugin: PluginContext, targets: SelectTarget[], mode: 'select' | 'hover', modifier: 'add' | 'set') {
    if (modifier === 'set')
        clearSelection(plugin, mode);

    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, targets[0]);
    if (!data) return;
    const analyzedTargets = analyzeTargets(targets);
    const expression = targetsToExpression(analyzedTargets);
    
    const loci = expressionToLoci(expression, data);
    if (mode === 'hover') {
        plugin.managers.interactivity.lociHighlights.highlight({ loci }, true);
    } else if (mode === 'select') {
        plugin.managers.structure.selection.fromLoci('add', loci, true);
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

export function getCurrentSelection(plugin: PluginContext) {
    const entries = plugin.managers.structure.selection.entries.values();
    const targets: Target[] = [];
    for (const { selection } of entries) {
        if (!selection) continue;
        addLociToTargets(selection, targets);
    }
    return targets;
}

export function getCurrentFocus(plugin: PluginContext) {
    const selection = plugin.managers.structure.focus.current?.loci;
    const targets: Target[] = [];
    if (selection) addLociToTargets(selection, targets);
    return targets;
}

export async function createComponent(plugin: PluginContext, componentLabel: string, targets: SelectTarget[]) {
    const structureRef = getStructureRefWithModelId(plugin.managers.structure.hierarchy.current.structures, targets[0]);
    if (!structureRef) throw Error('createComponent error: model not found');

    const analyzedTargets = analyzeTargets(targets);
    const expression = targetsToExpression(analyzedTargets);
    const sel = StructureSelectionQuery('innerQuery_' + Math.random().toString(36).substring(2), expression);
    await plugin.managers.structure.component.add({
        selection: sel,
        options: { checkExisting: false, label: componentLabel },
        representation: 'none',
    }, [structureRef]);
}

export async function addRepresentation(plugin: PluginContext, componentLabel: string, representationParam: any) {
    const param = createStructureRepresentationParams(plugin, undefined, representationParam);
    for (const c of plugin.managers.structure.hierarchy.currentComponentGroups) {
        for (const comp of c) {
            if (comp.cell.obj?.label === componentLabel) {
                await plugin.build().to(comp.cell).apply(StateTransforms.Representation.StructureRepresentation3D, param).commit();
                return;
            }
        }
    }
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

export async function createBoundingBox(plugin: PluginContext, label: string, min: number[], max: number[], radius: number, color: ColorName, alpha?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'BBGroup' })
    shapesGroup.apply(CreateBoundingBox, {
        min: min,
        max: max,
        label: label,
        radius: radius,
        color: ColorNames[color],
        alpha: alpha
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createSphere(plugin: PluginContext, label: string, center: number[], radius: number, color: ColorName, alpha?: number, detail?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'SphereGroup' })
    shapesGroup.apply(CreateSphere, {
        center: center,
        radius: radius,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        detail: detail
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createCylinder(plugin: PluginContext, label: string, start: number[], end: number[], color: ColorName, props?: BasicCylinderProps, alpha?: number, dashed?: boolean, dash_segments?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'CylinderGroup' })
    shapesGroup.apply(CreateCylinder, {
        start: start,
        end: end,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        dashed: dashed,
        dash_segments: dash_segments,
        props: props
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createPlane(plugin: PluginContext, label: string, center: number[], dirMajor: number[], dirMinor: number[], scale: number[], color: ColorName, alpha?: number, doubleSided?: boolean) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'PlaneGroup' })
    shapesGroup.apply(CreatePlane, {
        center: center,
        dirMajor: dirMajor,
        dirMinor: dirMinor,
        scale: scale,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        doubleSided: doubleSided
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createAxes(plugin: PluginContext, label: string, origin: number[], dirA: number[], dirB: number[], dirC: number[], color: ColorName, alpha?: number, radiusScale?: number, detail?: number, radialSegments?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'AxesGroup' })
    shapesGroup.apply(CreateAxes, {
        origin: origin,
        dirA: dirA,
        dirB: dirB,
        dirC: dirC,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        radiusScale: radiusScale,
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createEllipsoid(plugin: PluginContext, label: string, center: number[], dirMajor: number[], dirMinor: number[], radiusScale: number[], color: ColorName, alpha?: number, detail?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'EllipsoidGroup' })
    shapesGroup.apply(CreateEllipsoid, {
        center: center,
        dirMajor: dirMajor,
        dirMinor: dirMinor,
        radiusScale: radiusScale,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        detail: detail
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createRibbon(plugin: PluginContext, label: string, controlPoints: number[], normalVectors: number[], binormalVectors: number[], widthValues: number[], color: ColorName, alpha?: number, linearSegments?: number, arrowHeight?: number) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'RibbonGroup' })
    shapesGroup.apply(CreateRibbon, {
        controlPoints: controlPoints,
        normalVectors: normalVectors,
        binormalVectors: binormalVectors,
        heightValues: widthValues,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        linearSegments: linearSegments,
        arrowHeight: arrowHeight
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createSheet(plugin: PluginContext, label: string, controlPoints: number[], normalVectors: number[], binormalVectors: number[], widthValues: number[], heightValues: number[], color: ColorName, alpha?: number, linearSegments?: number, arrowHeight?: number, startCap?: boolean, endCap?: boolean) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'SheetGroup' })
    shapesGroup.apply(CreateSheet, {
        controlPoints: controlPoints,
        normalVectors: normalVectors,
        binormalVectors: binormalVectors,
        widthValues: widthValues,
        heightValues: heightValues,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        linearSegments: linearSegments,
        arrowHeight: arrowHeight,
        startCap: startCap,
        endCap: endCap
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function createTube(plugin: PluginContext, label: string, controlPoints: number[], normalVectors: number[], binormalVectors: number[], widthValues: number[], heightValues: number[], color: ColorName, alpha?: number, linearSegments?: number, radialSegments?: number, startCap?: boolean, endCap?: boolean, crossSection?: 'elliptical' | 'rounded', roundCap?: boolean) {
    const structure = plugin.build().toRoot();
    const shapesGroup = structure.apply(StateTransforms.Misc.CreateGroup, { label: 'TubeGroup' })
    shapesGroup.apply(CreateTube, {
        controlPoints: controlPoints,
        normalVectors: normalVectors,
        binormalVectors: binormalVectors,
        widthValues: widthValues,
        heightValues: heightValues,
        label: label,
        color: ColorNames[color],
        alpha: alpha,
        linearSegments: linearSegments,
        radialSegments: radialSegments,
        startCap: startCap,
        endCap: endCap,
        crossSection: crossSection,
        roundCap: roundCap
    })
    await structure.commit();
    return shapesGroup.ref;
}

export async function addMeasurement(plugin: PluginContext, targets: SelectTarget[][], type: MeasurementType) {
    const analyzedTargets: Target[][] = [];
    targets.forEach((target) => {
        analyzedTargets.push(analyzeTargets(target));
    }); 
    const manager = plugin.managers.structure.measurement;
    const data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, targets[0][0]);
    if (!data) return;
    if (type === 'label') {
        const exp = targetsToExpression(analyzedTargets[0]);
        const loci = expressionToLoci(exp, data);
        manager.addLabel(loci);
    } else if (type === 'distance') {
        const exp_a = targetsToExpression(analyzedTargets[0]);
        const exp_b = targetsToExpression(analyzedTargets[1]);
        const loci_a = expressionToLoci(exp_a, data);
        const loci_b = expressionToLoci(exp_b, data);
        manager.addDistance(loci_a, loci_b);
    } else if (type === 'angle') {
        const exp_a = targetsToExpression(analyzedTargets[0]);
        const exp_b = targetsToExpression(analyzedTargets[1]);
        const exp_c = targetsToExpression(analyzedTargets[2]);
        const loci_a = expressionToLoci(exp_a, data);
        const loci_b = expressionToLoci(exp_b, data);
        const loci_c = expressionToLoci(exp_c, data);
        manager.addAngle(loci_a, loci_b, loci_c);
    } else if (type === 'dihedral') {
        const exp_a = targetsToExpression(analyzedTargets[0]);
        const exp_b = targetsToExpression(analyzedTargets[1]);
        const exp_c = targetsToExpression(analyzedTargets[2]);
        const exp_d = targetsToExpression(analyzedTargets[3]);
        const loci_a = expressionToLoci(exp_a, data);
        const loci_b = expressionToLoci(exp_b, data);
        const loci_c = expressionToLoci(exp_c, data);
        const loci_d = expressionToLoci(exp_d, data);
        manager.addDihedral(loci_a, loci_b, loci_c, loci_d);
    } else {
        const locis = [];
        for (const target of analyzedTargets) {
            let exp = targetsToExpression(target);
            const loci = expressionToLoci(exp, data);
            if (loci) locis.push(loci);
        }
        if (type === 'orientation') {
            manager.addOrientation(locis);
        } else {
            manager.addPlane(locis);
        }
    }
}

export async function clearMeasurement(plugin: PluginContext) {
    const measurements = plugin.managers.structure.measurement.state;
    for (const key in measurements) {
        const value = measurements[key as keyof StructureMeasurementManagerState];
        if (Array.isArray(value) && value.length > 0) {
            for (const m of value) {
                await PluginCommands.State.RemoveObject(plugin, { state: m.parent!, ref: m.transform.parent, removeParentGhosts: true });
            }
        }
    }
}