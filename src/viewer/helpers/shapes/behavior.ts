import {PluginStateObject} from "molstar/lib/mol-plugin-state/objects";
import {PluginContext} from "molstar/lib/mol-plugin/context";
import {ParamDefinition as PD} from "molstar/lib/mol-util/param-definition";
import {ColorNames} from 'molstar/lib/mol-util/color/names';
import {StateTransformer} from "molstar/lib/mol-state/transformer";
import {Task} from "molstar/lib/mol-task";

import {
    TubeRepresentation,
    TubeParams,
    SquareRepresentation,
    SquareParams,
    BoxRepresentation,
    BoxParams
} from "./representation";

const CreateTransformer = StateTransformer.builderFactory('example-namespace');

export const CreateTube = CreateTransformer({
    name: 'create-tube',
    display: 'Tube',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        index: PD.Numeric(0),
        points: PD.Value([] as number[]),
        size: PD.Value(1.6)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Tube', async ctx => {
            const repr = TubeRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => TubeParams);
            await repr.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr, sourceData: a}, {label: `Tube ${params.index}`});
        });
    }
});


export const CreateShape = CreateTransformer({
    name: 'create-shape',
    display: 'Shape',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        index: PD.Numeric(0),
        vertices: PD.Value([] as number[]),
        size: PD.Numeric(1.6)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Shape', async ctx => {
            const repr = SquareRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => SquareParams);
            await repr.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr, sourceData: a}, {label: `Square ${params.index}`});
        });
    }
});


export const CreateBoundingBox = CreateTransformer({
    name: 'create-bounding-box',
    display: 'Bounding Box',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        min: PD.Value([0, 0, 0] as number[]),
        max: PD.Value([0, 0, 0] as number[]),
        label: PD.Text("Bounding Box"),
        radius: PD.Numeric(0.1),
        color: PD.Color(ColorNames.red)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Bounding Box', async ctx => {
            const box = BoxRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => BoxParams);
            await box.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: box, sourceData: a}, {label: params.label});
        });
    }
});
