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
import { CoordinatesFromDcd, CoordinatesFromXtc, CoordinatesFromTrr, CoordinatesFromNctraj, TrajectoryFromModelAndCoordinates } from 'molstar/lib/mol-plugin-state/transforms/model';
import { BuiltInTrajectoryFormat } from 'molstar/lib/mol-plugin-state/formats/trajectory';
import { BuiltInCoordinatesFormat } from 'molstar/lib/mol-plugin-state/formats/coordinates';
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
        topoFormat: BuiltInTrajectoryFormat,
        coordData: any,
        coordFormat: BuiltInCoordinatesFormat,
        props?: PresetProps,
        matrix?: Mat4,
        reprProvider?: TrajectoryHierarchyPresetProvider<P, S>,
        params?: P
    ): Promise<S | ReturnType<typeof RcsbPreset.apply> | undefined> {
        const temptraj = await this.plugin.builders.structure.parseTrajectory(topoData, topoFormat);
        const topol = await this.plugin.builders.structure.createModel(temptraj);
        let transform;
        switch (coordFormat) {
            case 'dcd':
                transform = CoordinatesFromDcd;
                break;
            case 'xtc':
                transform = CoordinatesFromXtc;
                break;
            case 'trr':
                transform = CoordinatesFromTrr;
                break;
            case 'nctraj':
                transform = CoordinatesFromNctraj;
                break;
        }
        const coords = await this.plugin.build().to(coordData).apply(transform, coordData).commit();
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