/**
 * Copyright (c) 2019-2020 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { BehaviorSubject } from 'rxjs';
import { ModelLoader } from './helpers/model';
import { TrajectoryLoader } from './helpers/trajectory';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { BuiltInTrajectoryFormat } from 'molstar/lib/mol-plugin-state/formats/trajectory';
import { BuiltInCoordinatesFormat } from 'molstar/lib/mol-plugin-state/formats/coordinates';

export type ModelUrlProvider = (pdbId: string) => {
    url: string,
    format: BuiltInTrajectoryFormat,
    isBinary: boolean
}

interface SharedParams {
    /** A supported file format extension string */
    format: BuiltInTrajectoryFormat,
    /** Set to true is the data is binary, e.g. bcif mmCIF files */
    isBinary: boolean
}

export interface LoadParams extends SharedParams {
    /** A File object or URL representing a structure file  */
    fileOrUrl: File | string
}

export interface CoordParams {
    /** A File object or URL representing a coordinate file  */
    format: BuiltInCoordinatesFormat,
    fileOrUrl: File | string,
    isBinary: boolean
}

export interface ParseParams extends SharedParams {
    /** string for text data, number[] for binary payload */
    data: string | number[] | Uint8Array
}

export type CollapsedState = {
    selection: boolean
    measurements: boolean
    strucmotifSubmit: boolean
    superposition: boolean
    quickStyles: boolean
    component: boolean
    volume: boolean
    assemblySymmetry: boolean
    validationReport: boolean
    custom: boolean
}

export interface ViewerState {
    showImportControls: boolean
    showSessionControls: boolean
    showStructureSourceControls: boolean
    showMeasurementsControls: boolean
    showStrucmotifSubmitControls: boolean
    showSuperpositionControls: boolean
    showQuickStylesControls: boolean
    showStructureComponentControls: boolean
    showVolumeStreamingControls: boolean
    showAssemblySymmetryControls: boolean
    showValidationReportControls: boolean

    modelLoader: ModelLoader
    trajectoryLoader: TrajectoryLoader

    collapsed: BehaviorSubject<CollapsedState>
    detachedFromSierra: boolean
}

export function ViewerState(plugin: PluginContext) {
    return plugin.customState as ViewerState;
}