import {PluginStateObject} from "molstar/lib/mol-plugin-state/objects";
import {PluginContext} from "molstar/lib/mol-plugin/context";
import {ParamDefinition as PD} from "molstar/lib/mol-util/param-definition";
import {ColorNames} from 'molstar/lib/mol-util/color/names';
import {StateTransformer} from "molstar/lib/mol-state/transformer";
import {Task} from "molstar/lib/mol-task";

import {
    BoxRepresentation,
    BoxParams,
    SphereRepresentation,
    SphereParams
} from "./representation";

const CreateTransformer = StateTransformer.builderFactory('example-namespace');

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
        color: PD.Color(ColorNames.red),
        alpha: PD.Numeric(1)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Bounding Box', async ctx => {
            const box = BoxRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...BoxParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await box.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: box, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateSphere = CreateTransformer({
    name: 'create-sphere',
    display: 'Sphere',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        center: PD.Value([0, 0, 0] as number[]),
        radius: PD.Numeric(1),
        label: PD.Text("Sphere"),
        color: PD.Color(ColorNames.blue),
        alpha: PD.Numeric(1),
        detail: PD.Numeric(6)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Sphere', async ctx => {
            const sphere = SphereRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...SphereParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await sphere.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: sphere, sourceData: a}, {label: params.label});
        });
    }
});
