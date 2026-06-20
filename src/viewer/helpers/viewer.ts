/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Joan Segura <joan.segura@rcsb.org>
 */

import { StructureRef } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy-state';
import { Structure, StructureElement, StructureSymmetry } from 'molstar/lib/mol-model/structure/structure';
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
    normalizeTarget,
    rangeToTest,
    SelectBase,
    SelectRange,
    SelectTarget,
    Target,
    targetToLoci,
    targetsToExpression,
    expressionToLoci,
    addLociToTargets
} from './selection';
import { ModelSymmetry } from 'molstar/lib/mol-model-formats/structure/property/symmetry';
import { EntitySubtype } from 'molstar/lib/mol-model/structure/model/properties/common';
import { CifCategory } from 'molstar/lib/mol-io/reader/cif';
import { StructureSelection, QueryContext, Model } from 'molstar/lib/mol-model/structure';
import { compile } from 'molstar/lib/mol-script/runtime/query/base';
import { Expression } from 'molstar/lib/mol-script/language/expression';


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
    let data: Structure | undefined;
    if (target.modelId) {
        data = getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, target.modelId);
    } else {
        data = plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
    }
    if (!data) return;

    const loci = targetToLoci(target, data);
    if (!loci) return;

    plugin.managers.structure.focus.setFromLoci(loci);
}

function getStructureWithModelId(structures: StructureRef[], modelId: string): Structure | undefined {
    if (!modelId) return undefined;
    
    const structureRef = getStructureRefWithModelId(structures, modelId);
    if (structureRef) return structureRef.cell?.obj?.data;
}

export function getStructureRefWithModelId(structures: StructureRef[], modelId: string): StructureRef | undefined {
    for (const structure of structures) {
        if (!structure.cell?.obj?.data?.units) continue;

        const unit = structure.cell.obj.data.units[0];
        if (unit.model.id === modelId) return structure;
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

export function clearSelection(plugin: PluginContext, mode: 'select' | 'hover', target?: Target) {
    if (mode === 'hover') {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }

    if (!target) {
        plugin.managers.interactivity.lociSelects.deselectAll();
        return;
    }

    const structure = (target.modelId) ?
        getStructureWithModelId(plugin.managers.structure.hierarchy.current.structures, target.modelId) :
        plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data;
    if (!structure) return;

    // This serves as adapter between the strucmotif-/BioJava-approach to identify transformed chains and the Mol* way
    // Only convert structOperId to operatorName, if operatorName is not defined
    if (target.structOperId && !target.operatorName) {
        target = normalizeTarget(target, structure) as SelectTarget;
    }
    const loci = targetToLoci(target, structure);
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
/**
 * Build a regex string that matches any string in the array.
 * @param values Array of strings to match
 * @returns regex string
 */
function buildRegexString(values: string[]): string {
    // Escape regex special characters in each string
    const escaped = values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Join with | to match any of them
    return `(${escaped.join('|')})`;
}

const getResidueCount = (structure: Structure, types?: EntitySubtype[], labelAsymId?: string) => {

    // Fast path: no filters
    if (!types?.length && !labelAsymId) return structure.atomicResidueCount;

    // Generate the filtered atom groups
    const expressionArgs: { [key: string]: Expression } = {};
    if (types?.length) {
        expressionArgs['entity-test'] = MS.core.logic.and([
            MS.core.rel.eq([MS.ammp('entityType'), 'polymer']),
            MS.core.str.match([
                MS.re(buildRegexString(types), 'i'),
                MS.ammp('entitySubtype')
            ])
        ]);
    }
    if (labelAsymId) {
        expressionArgs['chain-test'] = MS.core.rel.eq([labelAsymId, MS.ammp('label_asym_id')]);
    }
    const groups = MS.struct.generator.atomGroups(expressionArgs);

    // Compile and execute the query
    const selection = compile<StructureSelection>(MS.struct.modifier.union([groups]))(
        new QueryContext(structure)
    );
    return StructureSelection.unionStructure(selection).atomicResidueCount;
};

export function getAsymIdsFromStructureModel(m: Model, types?: EntitySubtype[], maxLength?: number) {
    const structAsymMap = m.properties.structAsymMap.values();
    const asymIds: Array<[string, string]> =
        Array.from(structAsymMap).map(({ id, auth_id }) => [id, auth_id]);
    if (!types && !maxLength) {
        return asymIds;
    }
    return asymIds.filter(([labelAsymId]) => {
        const base = Structure.ofModel(m);
        const residueCount = getResidueCount(base, types, labelAsymId);
        return residueCount > 0 && (!maxLength || residueCount <= maxLength);
    });
}

export async function getAssemblyIdsFromModel(m: Model, types?: EntitySubtype[], maxLength?: number) {
    const base = Structure.ofModel(m);
    const symmetry = ModelSymmetry.Provider.get(m);
    const assemblyIds = Array.isArray(symmetry?.assemblies) && symmetry.assemblies.length > 0
        ? symmetry.assemblies.map(a => a.id)
        : ['deposited'];
    if (!types && !maxLength) {
        return assemblyIds;
    }
    const out = [];
    for (const assemblyId of assemblyIds) {
        const assembly = assemblyId !== 'deposited'
            ? await StructureSymmetry.buildAssembly(base, assemblyId).run()
            : base;
        const residueCount = getResidueCount(assembly, types);
        const keep = residueCount > 0 && (!maxLength || residueCount <= maxLength);
        if (keep) out.push(assemblyId);
    }
    return out;
}

export function getDefaultStructure(plugin: PluginContext) {
    const refs = plugin.managers.structure.hierarchy.current.structures;
    if (refs.length === 0) return;
    const ref = refs[0];
    if (!ref) return;
    return ref.cell.obj?.data;
}

export function getDefaultModel(plugin: PluginContext) {
    const refs = plugin.managers.structure.hierarchy.current.models;
    if (refs.length === 0) return;
    const ref = refs[0];
    if (!ref) return;
    return ref.cell.obj?.data;
}

function parseOperatorList(value: string): string[][] {
    // '(X0)(1-5)' becomes [['X0'], ['1', '2', '3', '4', '5']]
    // kudos to Glen van Ginkel.

    const oeRegex = /\(?([^()]+)\)?]*/g,
        groups: string[] = [],
        ret: string[][] = [];

    let g: any;
    while ((g = oeRegex.exec(value))) groups[groups.length] = g[1];

    groups.forEach((g) => {
        const group: string[] = [];
        g.split(',').forEach((e) => {
            const dashIndex = e.indexOf('-');
            if (dashIndex > 0) {
                const from = parseInt(e.substring(0, dashIndex)),
                    to = parseInt(e.substring(dashIndex + 1));
                for (let i = from; i <= to; i++) group[group.length] = i.toString();
            } else {
                group[group.length] = e.trim();
            }
        });
        ret[ret.length] = group;
    });

    return ret;
}

function operatorEquals(expr: string, val: string): boolean {
    const list = parseOperatorList(expr);
    const split = val.split('x');
    let matches = 0;
    for (let i = 0, il = Math.min(list.length, split.length); i < il; i++) {
        if (list[i].indexOf(split[i]) !== -1) matches++;
    }
    return matches === split.length;
}

/**
 * Returns the first assembly ID whose generated assembly definition matches
 * all provided (structOperId, labelAsymId) combinations.
 *
 * The function iterates over rows in the `pdbx_struct_assembly_gen` category
 * and checks whether, for a given assembly:
 *  - the operator expression matches the provided structOperId, and
 *  - the asym_id_list contains the provided labelAsymId
 *
 * A row is considered a match only if **all** provided combinations satisfy
 * these conditions for that row. The first matching `assembly_id` is returned.
 *
 * @param pdbx_struct_assembly_gen
 *   CIF category describing how biological assemblies are generated.
 *   Expected to contain `assembly_id`, `oper_expression`, and `asym_id_list` fields.
 *
 * @param ids
 *   A list of [structOperId, labelAsymId] pairs to match against an assembly.
 *   These typically come from selected targets and represent the required
 *   operator and chain combinations that must be present in the assembly.
 *
 * @returns
 *   The first matching assembly ID, or `undefined` if no match is found
 *   or if the `pdbx_struct_assembly_gen` category is missing.
 *
 * @remarks
 * - `structOperId` defaults to `'1'` when not explicitly provided.
 * - Matching uses `operatorEquals` for operator expressions and a substring
 *   check for `labelAsymId` membership in `asym_id_list`.
 * - If the CIF file does not contain `pdbx_struct_assembly_gen`,
 *   a warning is logged and no value is returned.
 */
export function firstMatchingAssemblyId(pdbx_struct_assembly_gen: CifCategory, ids: string[][]) {
    if (pdbx_struct_assembly_gen) {
        const assembly_id = pdbx_struct_assembly_gen.getField('assembly_id');
        const oper_expression = pdbx_struct_assembly_gen.getField('oper_expression');
        const asym_id_list = pdbx_struct_assembly_gen.getField('asym_id_list');
        for (let i = 0, il = pdbx_struct_assembly_gen.rowCount; i < il; i++) {
            if (ids.some(val => !operatorEquals(oper_expression!.str(i), val[0]) || asym_id_list!.str(i).indexOf(val[1]) === -1)) continue;
            return assembly_id!.str(i);
        }
    } else {
        console.warn(`Source file is missing 'pdbx_struct_assembly_gen' category`);
    }
}