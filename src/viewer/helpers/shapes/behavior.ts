import {PluginStateObject} from "molstar/lib/mol-plugin-state/objects";
import {PluginContext} from "molstar/lib/mol-plugin/context";
import {ParamDefinition as PD} from "molstar/lib/mol-util/param-definition";
import {BasicCylinderProps} from "molstar/lib/mol-geo/geometry/mesh/builder/cylinder";
import {ColorNames} from 'molstar/lib/mol-util/color/names';
import {StateTransformer} from "molstar/lib/mol-state/transformer";
import {Task} from "molstar/lib/mol-task";

import {
    BoxRepresentation,
    BoxParams,
    SphereRepresentation,
    SphereParams,
    CylinderParams,
    CylinderRepresentation,
    PlaneParams,
    PlaneRepresentation,
    AxesRepresentation,
    AxesParams,
    EllipsoidRepresentation,
    EllipsoidParams,
    RibbonRepresentation,
    RibbonParams,
    SheetRepresentation,
    SheetParams,
    TubeRepresentation,
    TubeParams
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

export const CreateCylinder = CreateTransformer({
    name: 'create-cylinder',
    display: 'Cylinder',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        start: PD.Value([0, 0, 0] as number[]),
        end: PD.Value([1, 1, 1] as number[]),
        label: PD.Text("Cylinder"),
        color: PD.Color(ColorNames.yellow),
        alpha: PD.Numeric(1),
        dashed: PD.Boolean(false),
        dash_segments: PD.Numeric(6),
        props: PD.Value({radiusTop: 0.1,
            radiusBottom: 0.1,
            radialSegments:100,
            heightSegments:100,
            topCap: true,
            bottomCap: true,
            } as BasicCylinderProps
        )
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Cylinder', async ctx => {
            const cylinder = CylinderRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...CylinderParams,
                alpha: PD.Numeric(params.alpha),
                dashed: PD.Boolean(params.dashed),
                dash_segments: PD.Numeric(params.dash_segments)
            }));
            await cylinder.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: cylinder, sourceData: a}, {label: params.label});
        });
    }
});

export const CreatePlane = CreateTransformer({
    name: 'create-plane',
    display: 'Plane',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        center: PD.Value([0, 0, 0] as number[]),
        dirMajor: PD.Value([1, 0, 0] as number[]),
        dirMinor: PD.Value([0, 1, 0] as number[]),
        scale: PD.Value([1, 1, 1] as number[]),
        label: PD.Text("Plane"),
        color: PD.Color(ColorNames.lightblue),
        alpha: PD.Numeric(1),
        doubleSided: PD.Boolean(true)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Plane', async ctx => {
            const plane = PlaneRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...PlaneParams,
                alpha: PD.Numeric(params.alpha),
                doubleSided: PD.Boolean(params.doubleSided)
            }));
            await plane.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: plane, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateAxes = CreateTransformer({
    name: 'create-axes',
    display: 'Axes',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        origin: PD.Value([0, 0, 0] as number[]),
        dirA: PD.Value([1, 0, 0] as number[]),
        dirB: PD.Value([0, 1, 0] as number[]),
        dirC: PD.Value([0, 0, 1] as number[]),
        label: PD.Text("Axes"),
        color: PD.Color(ColorNames.grey),
        alpha: PD.Numeric(1),
        radiusScale: PD.Numeric(1)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Axes', async ctx => {
            const axes = AxesRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...AxesParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await axes.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: axes, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateEllipsoid = CreateTransformer({
    name: 'create-ellipsoid',
    display: 'Ellipsoid',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        center: PD.Value([0, 0, 0] as number[]),
        dirMajor: PD.Value([1, 0, 0] as number[]),
        dirMinor: PD.Value([0, 1, 0] as number[]),
        radiusScale: PD.Value([1, 1, 1] as number[]),
        label: PD.Text("Ellipsoid"),
        color: PD.Color(ColorNames.green),
        alpha: PD.Numeric(1),
        detail: PD.Numeric(6)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Ellipsoid', async ctx => {
            const ellipsoid = EllipsoidRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...EllipsoidParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await ellipsoid.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: ellipsoid, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateRibbon = CreateTransformer({
    name: 'create-ribbon',
    display: 'Ribbon',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        controlPoints: PD.Value([] as number[]),
        normalVectors: PD.Value([] as number[]),
        binormalVectors: PD.Value([] as number[]),
        linearSegments: PD.Numeric(1),
        widthValues: PD.Value([0, 0, 0] as number[]),
        heightValues: PD.Value([] as number[]),
        arrowHeight: PD.Numeric(0),
        label: PD.Text("Ribbon"),
        color: PD.Color(ColorNames.purple),
        alpha: PD.Numeric(1)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Ribbon', async ctx => {
            const ribbon = RibbonRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...RibbonParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await ribbon.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: ribbon, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateSheet = CreateTransformer({
    name: 'create-sheet',
    display: 'Sheet',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        controlPoints: PD.Value([] as number[]),
        normalVectors: PD.Value([] as number[]),
        binormalVectors: PD.Value([] as number[]),
        linearSegments: PD.Numeric(1),
        widthValues: PD.Value([] as number[]),
        heightValues: PD.Value([] as number[]),
        arrowHeight: PD.Numeric(0),
        startCap: PD.Boolean(true),
        endCap: PD.Boolean(true),
        label: PD.Text("Sheet"),
        color: PD.Color(ColorNames.orange),
        alpha: PD.Numeric(1)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Sheet', async ctx => {
            const sheet = SheetRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...SheetParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await sheet.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: sheet, sourceData: a}, {label: params.label});
        });
    }
});

export const CreateTube = CreateTransformer({
    name: 'create-tube',
    display: 'Tube',
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Representation3D,
    params: {
        controlPoints: PD.Value([] as number[]),
        normalVectors: PD.Value([] as number[]),
        binormalVectors: PD.Value([] as number[]),
        linearSegments: PD.Numeric(1),
        radialSegments: PD.Numeric(12),
        widthValues: PD.Value([] as number[]),
        heightValues: PD.Value([] as number[]),
        startCap: PD.Boolean(true),
        endCap: PD.Boolean(true),
        crossSection: PD.Select('elliptical', [['elliptical', 'Elliptical'], ['rounded', 'Rounded']] as const),
        roundCap: PD.Boolean(false),
        label: PD.Text("Tube"),
        color: PD.Color(ColorNames.cyan),
        alpha: PD.Numeric(1)
    }
})({
    canAutoUpdate({oldParams, newParams}) {
        return true;
    },
    apply({a, params}, plugin: PluginContext) {
        return Task.create('Tube', async ctx => {
            const tube = TubeRepresentation({webgl: plugin.canvas3d?.webgl, ...plugin.representation.structure.themes}, () => ({
                ...TubeParams,
                alpha: PD.Numeric(params.alpha)
            }));
            await tube.createOrUpdate({}, params).runInContext(ctx);
            return new PluginStateObject.Shape.Representation3D({repr: tube, sourceData: a}, {label: params.label});
        });
    }
});
