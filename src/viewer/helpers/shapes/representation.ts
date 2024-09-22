import {ParamDefinition as PD} from "molstar/lib/mol-util/param-definition";
import {Representation, RepresentationContext, RepresentationParamsGetter} from "molstar/lib/mol-repr/representation";
import {Vec3} from "molstar/lib/mol-math/linear-algebra/3d";
import {Box3D} from 'molstar/lib/mol-math/geometry';
import {MeshBuilder} from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import {RuntimeContext} from "molstar/lib/mol-task";
import {addSphere} from "molstar/lib/mol-geo/geometry/mesh/builder/sphere";
import {ShapeRepresentation} from "molstar/lib/mol-repr/shape/representation";
import {getBoxMesh} from 'molstar/lib/mol-plugin-state/transforms/shape';
import {Color} from "molstar/lib/mol-util/color/color";
import {Mesh} from "molstar/lib/mol-geo/geometry/mesh/mesh";
import {Shape} from "molstar/lib/mol-model/shape/shape";


// Bounding Box Representation

interface BoxData {
  min: number[],
  max: number[],
  label: string,
  radius: number,
  color: Color
}

export const BoxParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true)
}
export type BoxParams = typeof BoxParams;
export type BoxProps = PD.Values<BoxParams>

const BoxVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<BoxData, BoxParams>) => ShapeRepresentation(getBoxShape, Mesh.Utils)
}

function getBoxShape(ctx: RuntimeContext, data: BoxData, props: BoxProps, shape?: Shape<Mesh>) {
    const bbox = Box3D();
    bbox.min = Vec3.create(data.min[0], data.min[1], data.min[2]);
    bbox.max = Vec3.create(data.max[0], data.max[1], data.max[2]);
    const geo = getBoxMesh(bbox, data.radius, shape === null || shape === void 0 ? void 0 : shape.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => data.radius, () => data.label);
}
export type BoxRepresentation = Representation<BoxData, BoxParams>

export function BoxRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<BoxData, BoxParams>): BoxRepresentation {
  return Representation.createMulti('Box', ctx, getParams, Representation.StateBuilder, BoxVisuals as unknown as Representation.Def<BoxData, BoxParams>)
}

// Sphere Representation

interface SphereData {
  center: number[],
  radius: number,
  label: string,
  color: Color,
  detail: number,
}

export const SphereParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type SphereParams = typeof SphereParams;
export type SphereProps = PD.Values<SphereParams>

const SphereVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<SphereData, SphereParams>) => ShapeRepresentation(getSphereShape, Mesh.Utils)
}

function getSphereMesh(data: SphereData, props: SphereProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  addSphere(builderState, Vec3.create(data.center[0], data.center[1], data.center[2]), data.radius, data.detail)
  return MeshBuilder.getMesh(builderState);
}

function getSphereShape(ctx: RuntimeContext, data: SphereData, props: SphereProps, shape?: Shape<Mesh>) {
    const geo = getSphereMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => data.radius, () => data.label);
}

export type SphereRepresentation = Representation<SphereData, SphereParams>

export function SphereRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<SphereData, SphereParams>): SphereRepresentation {
  return Representation.createMulti('sphere', ctx, getParams, Representation.StateBuilder, SphereVisuals as unknown as Representation.Def<SphereData, SphereParams>)
}
