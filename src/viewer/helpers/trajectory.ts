/**
 * Copyright (c) 2019-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { LoadParams, ParseParams, CoordParams } from '../types';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PresetProps, RcsbPreset } from './preset';
import { Asset } from 'molstar/lib/mol-util/assets';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StateObjectSelector/*, StateSelection*/ } from 'molstar/lib/mol-state';
import { TrajectoryFromModelAndCoordinates } from 'molstar/lib/mol-plugin-state/transforms/model';
import { BuiltInTrajectoryFormat } from 'molstar/lib/mol-plugin-state/formats/trajectory';
import { BuiltInCoordinatesFormat } from 'molstar/lib/mol-plugin-state/formats/coordinates';
import { BuiltInTopologyFormat } from 'molstar/lib/mol-plugin-state/formats/topology';
import { TrajectoryHierarchyPresetProvider } from 'molstar/lib/mol-plugin-state/builder/structure/hierarchy-preset';

export class TrajectoryLoader {
    async load<P = {}, S={}>(topo: any, coord: any, props?: PresetProps, matrix?: Mat4, reprProvider?: TrajectoryHierarchyPresetProvider<P, S>, params?: P) {
        const topoData = topo.type === 'url' ? await this.dataFromFile({fileOrUrl: topo.data, format: topo.format, isBinary: false})
                                             : await this.dataFromString({data: topo.data, format: topo.format, isBinary: false});
        const coordData = coord.type === 'url' ? await this.dataFromFile({fileOrUrl: coord.data, format: coord.format, isBinary: true})
                                               : await this.dataFromString({data: new Uint8Array(atob(coord.data).split('').map(char => char.charCodeAt(0))), format: coord.format, isBinary: true});
        return await this.handleModelAndCoordinates<P, S>(topoData, topo.format, coordData, coord.format, props, matrix, reprProvider, params);
    }
    async dataFromFile(param: LoadParams | CoordParams) {
        const { fileOrUrl, isBinary } = param;
        const data = fileOrUrl instanceof File
            ? (await this.plugin.builders.data.readFile({ file: Asset.File(fileOrUrl), isBinary })).data
            : await this.plugin.builders.data.download({ url: fileOrUrl, isBinary });
        return data;
    }
    async dataFromString(param: ParseParams) {
        const { data } = param;
        const _data = await this.plugin.builders.data.rawData({ data });
        return _data;
    }

    private async handleModelAndCoordinates<P = {}, S = {}>(
        topoData: any,
        topoFormat: BuiltInTrajectoryFormat | BuiltInTopologyFormat,
        coordData: any,
        coordFormat: BuiltInCoordinatesFormat,
        props?: PresetProps,
        matrix?: Mat4,
        reprProvider?: TrajectoryHierarchyPresetProvider<P, S>,
        params?: P
    ): Promise<S | ReturnType<typeof RcsbPreset.apply> | undefined> {
        const topologyFormatValues = ['psf', 'prmtop', 'top'];
        const isTopologyFormat = (format: any): format is BuiltInTopologyFormat => 
            topologyFormatValues.includes(format as string);
        let topol: StateObjectSelector;
        if (isTopologyFormat(topoFormat)) {
            const provider = this.plugin.dataFormats.get(topoFormat);
            topol = await provider!.parse(this.plugin, topoData);
        } else {
            const temptraj = await this.plugin.builders.structure.parseTrajectory(topoData, topoFormat);
            topol = await this.plugin.builders.structure.createModel(temptraj);
        }
        const provider = this.plugin.dataFormats.get(coordFormat);
        const coords = await provider!.parse(this.plugin, coordData);
        const trajectory = await this.plugin.build().toRoot()
            .apply(TrajectoryFromModelAndCoordinates, {
                modelRef: topol.ref,
                coordinatesRef: coords.ref
            }, { dependsOn: [topol.ref, coords.ref] }).commit();
        if (reprProvider) {
            return this.plugin.builders.structure.hierarchy.applyPreset(trajectory, reprProvider, params);
        } else {
            const selector = await this.plugin.builders.structure.hierarchy.applyPreset(trajectory, RcsbPreset, {
                preset: props || { kind: 'standard', assemblyId: '' }
            });

            if (matrix && selector?.structureProperties) {
                const params = {
                    transform: {
                        name: 'matrix' as const,
                        params: { data: matrix, transpose: false }
                    }
                };
                const b = this.plugin.state.data.build().to(selector.structureProperties)
                    .insert(StateTransforms.Model.TransformStructureConformation, params);
                await this.plugin.runTask(this.plugin.state.data.updateTree(b));
            }
            return selector;
        }

    }

    constructor(private plugin: PluginContext) {

    }
}

export function setFrame(plugin: any, frameIdx: number) {
    const state = plugin.state.data;
    const loadedStructures = plugin.managers.structure.hierarchy.current.structures;
    for (const s of loadedStructures) {
        const m = s.model;
        const parent = state.cells.get(m.cell.sourceRef)!.obj as PluginStateObject.Molecule.Trajectory;
        if (!parent) return;
        plugin.state.updateTransform(state, m.cell.transform.ref, () => {
            let modelIndex: number;
            if (frameIdx < 0 ) {modelIndex = 0;}
            else if (frameIdx < parent.data.frameCount) {modelIndex = frameIdx;}
            else {modelIndex = parent.data.frameCount - 1;}
            return { modelIndex };
        }, 'Model Index')
    }
}

