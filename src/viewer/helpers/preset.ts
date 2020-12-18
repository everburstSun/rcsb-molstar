/**
 * Copyright (c) 2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import Expression from 'molstar/lib/mol-script/language/expression';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { TrajectoryHierarchyPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/hierarchy-preset';
import { ValidationReportGeometryQualityPreset } from 'molstar/lib/extensions/rcsb/validation-report/behavior';
import { AssemblySymmetryPreset } from 'molstar/lib/extensions/rcsb/assembly-symmetry/behavior';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { RootStructureDefinition } from 'molstar/lib/mol-plugin-state/helpers/root-structure';
import { StructureRepresentationPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { Structure, StructureSelection, QueryContext, StructureElement } from 'molstar/lib/mol-model/structure';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { InitVolumeStreaming } from 'molstar/lib/mol-plugin/behavior/dynamic/volume-streaming/transformers';
import { ViewerState } from '../types';
import { StateSelection, StateObjectSelector, StateObject, StateTransformer } from 'molstar/lib/mol-state';
import { VolumeStreaming } from 'molstar/lib/mol-plugin/behavior/dynamic/volume-streaming/behavior';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureSelectionFromExpression, CustomStructureProperties } from 'molstar/lib/mol-plugin-state/transforms/model';
import { FlexibleStructureFromModel as FlexibleStructureFromModel } from './superpose/flexible-structure';

type Target = {
    readonly auth_seq_id?: number
    readonly label_seq_id?: number
    readonly label_comp_id?: string
    readonly label_asym_id?: string
}

function targetToExpression(target: Target): Expression {
    const residueTests: Expression[] = []
    const tests = Object.create(null)

    if (target.auth_seq_id) {
        residueTests.push(MS.core.rel.eq([target.auth_seq_id, MS.ammp('auth_seq_id')]))
    } else if (target.label_seq_id) {
        residueTests.push(MS.core.rel.eq([target.label_seq_id, MS.ammp('label_seq_id')]))
    }
    if (target.label_comp_id) {
        residueTests.push(MS.core.rel.eq([target.label_comp_id, MS.ammp('label_comp_id')]))
    }
    if (residueTests.length === 1) {
        tests['residue-test'] = residueTests[0]
    } else if (residueTests.length > 1) {
        tests['residue-test'] = MS.core.logic.and(residueTests)
    }

    if (target.label_asym_id) {
        tests['chain-test'] = MS.core.rel.eq([target.label_asym_id, MS.ammp('label_asym_id')])
    }

    if (Object.keys(tests).length > 0) {
        return MS.struct.modifier.union([
            MS.struct.generator.atomGroups(tests)
        ])
    } else {
        return MS.struct.generator.empty
    }
}

function targetToLoci(target: Target, structure: Structure): StructureElement.Loci {
    const expression = targetToExpression(target)
    const query = compile<StructureSelection>(expression)
    const selection = query(new QueryContext(structure));
    return StructureSelection.toLociWithSourceUnits(selection)
}

type Range = {asymId: string, beg?: number, end?: number}

type BaseProps = {
    assemblyId?: string
    modelIndex?: number
}

type ColorProp = {
    name: 'color',
    value: number
};

type PropSet = {
    args: ColorProp,
    positions: number[]
};

export type PropsetProps = {
    kind: 'prop-set',
    selection?: (Range & {
        matrix?: Mat4
    })[],
    representation: {
        asymId: string,
        propset: PropSet[]
    }[]
} & BaseProps

type ValidationProps = {
    kind: 'validation'
    colorTheme?: string
    showClashes?: boolean
} & BaseProps

type StandardProps = {
    kind: 'standard'
} & BaseProps

type SymmetryProps = {
    kind: 'symmetry'
    symmetryIndex?: number
} & BaseProps

type FeatureProps = {
    kind: 'feature'
    target: Target
} & BaseProps

type DensityProps = {
    kind: 'density'
} & BaseProps

export type PresetProps = ValidationProps | StandardProps | SymmetryProps | FeatureProps | DensityProps | PropsetProps

const RcsbParams = (a: PluginStateObject.Molecule.Trajectory | undefined, plugin: PluginContext) => ({
    preset: PD.Value<PresetProps>({ kind: 'standard', assemblyId: '' }, { isHidden: true })
});

type StructureObject = StateObjectSelector<PluginStateObject.Molecule.Structure, StateTransformer<StateObject<any, StateObject.Type<any>>, StateObject<any, StateObject.Type<any>>, any>>

export const RcsbPreset = TrajectoryHierarchyPresetProvider({
    id: 'preset-trajectory-rcsb',
    display: { name: 'RCSB' },
    isApplicable: o => {
        return true
    },
    params: RcsbParams,
    async apply(trajectory, params, plugin) {
        const builder = plugin.builders.structure;
        const p = params.preset

        const modelParams = { modelIndex: p.modelIndex || 0 }

        const structureParams: RootStructureDefinition.Params = { name: 'model', params: {} }
        if (p.assemblyId && p.assemblyId !== '' && p.assemblyId !== '0') {
            Object.assign(structureParams, {
                name: 'assembly',
                params: { id: p.assemblyId }
            } as RootStructureDefinition.Params)
        }

        const model = await builder.createModel(trajectory, modelParams);
        const modelProperties = await builder.insertModelProperties(model);

        let structure: StructureObject | undefined = undefined;
        let structureProperties: StructureObject | undefined = undefined;

        // if flexible transformation is allowed, we may need to create a single structure component
        // from transformed substructures
        const allowsFlexTransform = p.kind === 'prop-set';
        if (!allowsFlexTransform) {
            structure = await builder.createStructure(modelProperties || model, structureParams);
            structureProperties = await builder.insertStructureProperties(structure);
        }

        const unitcell = await builder.tryCreateUnitcell(modelProperties, undefined, { isHidden: true });

        let representation: StructureRepresentationPresetProvider.Result | undefined = undefined;

        if (p.kind === 'prop-set') {

            // this creates a single structure from selections/transformations as specified
            const _structure = plugin.state.data.build().to(modelProperties)
                .apply(FlexibleStructureFromModel, { selection: p.selection });
            structure = await _structure.commit();

            const _structureProperties = plugin.state.data.build().to(structure)
                .apply(CustomStructureProperties);
            structureProperties = await _structureProperties.commit();

            const entryId = model.data?.entryId;
            const selections: StructureObject[] = [];
            if (p.selection) {
                for (const s of p.selection) {
                    const sele = plugin.state.data.build().to(structureProperties!)
                        .apply(StructureSelectionFromExpression, createSelection(entryId, s));
                    selections.push(await sele.commit());
                }
            } else {
                const sele = plugin.state.data.build().to(structureProperties!)
                    .apply(StructureSelectionFromExpression, createSelection(entryId));
                selections.push(await sele.commit());
            }

            console.log(selections);

            // At this we have a structure that contains only the transformed substructres
            // The color theme data should be added to `structureProperties.data?.inheritedPropertyData`

            const representations = new Array();
            for (const r of p.representation) {
                for (const sele of selections) {
                    if(!sele.data!.inheritedPropertyData.colors) {
                        sele.data!.inheritedPropertyData.colors = {};
                    }
                    let colorLookup = sele.data!.inheritedPropertyData.colors[r.asymId] || new Map();
                    r.propset.forEach(prop => {
                        if (prop.args.name === 'color') {
                            for (let i = 0; i < prop.positions.length; i++) {
                                colorLookup.set(prop.positions[i], prop.args.value);
                            }
                        }
                    });
                    sele.data!.inheritedPropertyData.colors[r.asymId] = colorLookup;
                    const repr = await plugin.builders.structure.representation.applyPreset(sele, 'polymer-cartoon', {
                        theme: { globalName: 'superpose', focus: { name: 'superpose' } }
                    });
                    representations.push(repr);
                }
            }

            // // this adds a single component
            // representation = await plugin.builders.structure.representation.applyPreset(structureProperties, 'polymer-cartoon', {
            //     theme: { globalName: 'superpose', focus: { name: 'superpose' } }
            // });

        } else if (p.kind === 'validation') {
            representation = await plugin.builders.structure.representation.applyPreset(structureProperties!, ValidationReportGeometryQualityPreset);

        } else if (p.kind === 'symmetry') {
            representation = await plugin.builders.structure.representation.applyPreset<any>(structureProperties!, AssemblySymmetryPreset, { symmetryIndex: p.symmetryIndex });

            ViewerState(plugin).collapsed.next({
                ...ViewerState(plugin).collapsed.value,
                custom: false
            })
        } else {
            representation = await plugin.builders.structure.representation.applyPreset(structureProperties!, 'auto');
        }

        if (p.kind === 'feature' && structure?.obj) {
            const loci = targetToLoci(p.target, structure.obj.data)
            // if target is only defined by chain: then don't force first residue
            const chainMode = p.target.label_asym_id && !p.target.auth_seq_id && !p.target.label_seq_id && !p.target.label_comp_id;
            const target = chainMode ? loci : StructureElement.Loci.firstResidue(loci)
            plugin.managers.structure.focus.setFromLoci(target)
            plugin.managers.camera.focusLoci(target)
        }

        if (p.kind === 'density' && structure?.cell?.parent) {
            const volumeRoot = StateSelection.findTagInSubtree(structure.cell.parent.tree, structure.cell.transform.ref, VolumeStreaming.RootTag);
            if (!volumeRoot) {
                const params = PD.getDefaultValues(InitVolumeStreaming.definition.params!(structure.obj!, plugin))
                await plugin.runTask(plugin.state.data.applyAction(InitVolumeStreaming, params, structure.ref))
            }

            ViewerState(plugin).collapsed.next({
                ...ViewerState(plugin).collapsed.value,
                volume: false
            })
        }

        return {
            model,
            modelProperties,
            unitcell,
            structure,
            structureProperties,
            representation
        };
    }
});

export function createSelection(entryId: string | undefined, range?: Range) {

    if (!entryId) return {};

    if (range) {
        const residues: number[] = (range.beg && range.end) ? createRange(range.beg, range.end) : [];
        const test = createTest(range.asymId, residues);
        const label = createLabel(entryId, range);
        return {
            expression: MS.struct.generator.atomGroups(test),
            label: `${label}`
        }
    } else {
        return {
            expression: MS.struct.generator.all(),
            label: `${entryId}`
        }
    }
}

export const createTest = (asymId: string, residues: number[]) => {
    if (residues.length > 0) {
        return {
            'chain-test': testChain(asymId),
            'residue-test': testResidues(residues)
        };
    } else {
        return {'chain-test': testChain(asymId)};
    }
}

const testChain = (asymId: string) => {
    return MS.core.rel.eq([MS.ammp('label_asym_id'), asymId]);
}

const testResidues = (residueSet: number[]) => {
    return MS.core.set.has([MS.set(...residueSet), MS.ammp('label_seq_id')]);
}

export const createRange = (start: number, end: number) => [...Array(end - start + 1)].map((_, i) => start + i);

const createLabel = (entryId: string, range: Range) => {
    let label = ''.concat(entryId, '.', range.asymId);
    if ( ! (range.beg && range.end) ) return label;
    return ''.concat(label, ':', ''.concat(range.beg.toString(),'-',range.end.toString()))
}
