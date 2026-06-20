import {ParamDefinition as PD} from "molstar/lib/mol-util/param-definition";
import {Representation, RepresentationContext, RepresentationParamsGetter} from "molstar/lib/mol-repr/representation";
import {Vec3} from "molstar/lib/mol-math/linear-algebra/3d";
import {Box3D, Axes3D} from 'molstar/lib/mol-math/geometry';
import {MeshBuilder} from "molstar/lib/mol-geo/geometry/mesh/mesh-builder";
import {RuntimeContext} from "molstar/lib/mol-task";
import {addSimpleCylinder, addFixedCountDashedCylinder, BasicCylinderProps} from "molstar/lib/mol-geo/geometry/mesh/builder/cylinder";
import {addSphere} from "molstar/lib/mol-geo/geometry/mesh/builder/sphere";
import {addPlane} from "molstar/lib/mol-geo/geometry/mesh/builder/plane";
import {addAxes} from "molstar/lib/mol-geo/geometry/mesh/builder/axes";
import {addEllipsoid} from "molstar/lib/mol-geo/geometry/mesh/builder/ellipsoid";
import {addRibbon} from "molstar/lib/mol-geo/geometry/mesh/builder/ribbon";
import {addSheet} from "molstar/lib/mol-geo/geometry/mesh/builder/sheet";
import {addTube} from "molstar/lib/mol-geo/geometry/mesh/builder/tube";
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

// Cylinder Representation

interface CylinderData {
  start: number[],
  end: number[],
  label: string,
  color: Color,
  props: BasicCylinderProps,
}

export const CylinderParams = {
  ...Mesh.Params,
  dashed: PD.Boolean(false),
  dash_segments: PD.Numeric(6)
}
export type CylinderParams = typeof CylinderParams;
export type CylinderProps = PD.Values<CylinderParams>

const CylinderVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<CylinderData, CylinderParams>) => ShapeRepresentation(getCylinderShape, Mesh.Utils)
}

function getCylinderMesh(data: CylinderData, props: CylinderProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  if (props.dashed) {
    addFixedCountDashedCylinder(builderState, Vec3.create(data.start[0], data.start[1], data.start[2]), Vec3.create(data.end[0], data.end[1], data.end[2]),
    1, props.dash_segments, true, data.props);
  } else {
    addSimpleCylinder(builderState, Vec3.create(data.start[0], data.start[1], data.start[2]), Vec3.create(data.end[0], data.end[1], data.end[2]), data.props);
  }
  return MeshBuilder.getMesh(builderState);
}

function getCylinderShape(ctx: RuntimeContext, data: CylinderData, props: CylinderProps, shape?: Shape<Mesh>) {
    const geo = getCylinderMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => data.props.radiusTop ?? 0.5, () => data.label);
}

export type CylinderRepresentation = Representation<CylinderData, CylinderParams>

export function CylinderRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<CylinderData, CylinderParams>): CylinderRepresentation {
  return Representation.createMulti('cylinder', ctx, getParams, Representation.StateBuilder, CylinderVisuals as unknown as Representation.Def<CylinderData, CylinderParams>)
}

// Plane Representation

interface PlaneData {
  center: number[],
  dirMajor: number[],
  dirMinor: number[],
  scale: number[],
  label: string,
  color: Color
}

export const PlaneParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type PlaneParams = typeof PlaneParams;
export type PlaneProps = PD.Values<PlaneParams>

const PlaneVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<PlaneData, PlaneParams>) => ShapeRepresentation(getPlaneShape, Mesh.Utils)
}

function getPlaneShape(ctx: RuntimeContext, data: PlaneData, props: PlaneProps, shape?: Shape<Mesh>) {
    const builderState = MeshBuilder.createState(256, 128, shape?.geometry);
    builderState.currentGroup = 1;
    addPlane(builderState, Vec3.create(data.center[0], data.center[1], data.center[2]), Vec3.create(data.dirMajor[0], data.dirMajor[1], data.dirMajor[2]), Vec3.create(data.dirMinor[0], data.dirMinor[1], data.dirMinor[2]), Vec3.create(data.scale[0], data.scale[1], data.scale[2]), 1, 1);
    const geo = MeshBuilder.getMesh(builderState);
    return Shape.create(data.label, data, geo, () => data.color, () => 1, () => data.label);
}

export type PlaneRepresentation = Representation<PlaneData, PlaneParams>

export function PlaneRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<PlaneData, PlaneParams>): PlaneRepresentation {
  return Representation.createMulti('plane', ctx, getParams, Representation.StateBuilder, PlaneVisuals as unknown as Representation.Def<PlaneData, PlaneParams>)
}

// Axes Representation

interface AxesData {
  origin: number[],
  dirA: number[],
  dirB: number[],
  dirC: number[],
  label: string,
  color: Color,
  radiusScale: number,
}

export const AxesParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type AxesParams = typeof AxesParams;
export type AxesProps = PD.Values<AxesParams>

const AxesVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<AxesData, AxesParams>) => ShapeRepresentation(getAxesShape, Mesh.Utils)
}

function getAxesMesh(data: AxesData, props: AxesProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  const axes: Axes3D = {
    origin: Vec3.create(data.origin[0], data.origin[1], data.origin[2]),
    dirA: Vec3.create(data.dirA[0], data.dirA[1], data.dirA[2]),
    dirB: Vec3.create(data.dirB[0], data.dirB[1], data.dirB[2]),
    dirC: Vec3.create(data.dirC[0], data.dirC[1], data.dirC[2]),
  };
  addAxes(builderState, axes, data.radiusScale, 6, 24);
  return MeshBuilder.getMesh(builderState);
}

function getAxesShape(ctx: RuntimeContext, data: AxesData, props: AxesProps, shape?: Shape<Mesh>) {
    const geo = getAxesMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => data.radiusScale, () => data.label);
}

export type AxesRepresentation = Representation<AxesData, AxesParams>

export function AxesRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<AxesData, AxesParams>): AxesRepresentation {
  return Representation.createMulti('axes', ctx, getParams, Representation.StateBuilder, AxesVisuals as unknown as Representation.Def<AxesData, AxesParams>)
}

// Ellipsoid Representation

interface EllipsoidData {
  center: number[],
  dirMajor: number[],
  dirMinor: number[],
  radiusScale: number[],
  label: string,
  color: Color,
  detail: number,
}

export const EllipsoidParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type EllipsoidParams = typeof EllipsoidParams;
export type EllipsoidProps = PD.Values<EllipsoidParams>

const EllipsoidVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<EllipsoidData, EllipsoidParams>) => ShapeRepresentation(getEllipsoidShape, Mesh.Utils)
}

function getEllipsoidMesh(data: EllipsoidData, props: EllipsoidProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  addEllipsoid(
    builderState,
    Vec3.create(data.center[0], data.center[1], data.center[2]),
    Vec3.create(data.dirMajor[0], data.dirMajor[1], data.dirMajor[2]),
    Vec3.create(data.dirMinor[0], data.dirMinor[1], data.dirMinor[2]),
    Vec3.create(data.radiusScale[0], data.radiusScale[1], data.radiusScale[2]),
    data.detail
  );
  return MeshBuilder.getMesh(builderState);
}

function getEllipsoidShape(ctx: RuntimeContext, data: EllipsoidData, props: EllipsoidProps, shape?: Shape<Mesh>) {
    const geo = getEllipsoidMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => Math.max(...data.radiusScale), () => data.label);
}

export type EllipsoidRepresentation = Representation<EllipsoidData, EllipsoidParams>

export function EllipsoidRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<EllipsoidData, EllipsoidParams>): EllipsoidRepresentation {
  return Representation.createMulti('ellipsoid', ctx, getParams, Representation.StateBuilder, EllipsoidVisuals as unknown as Representation.Def<EllipsoidData, EllipsoidParams>)
}

// Ribbon Representation

interface RibbonData {
  controlPoints: number[],
  normalVectors: number[],
  binormalVectors: number[],
  linearSegments: number,
  widthValues: number[],
  heightValues: number[],
  arrowHeight: number,
  label: string,
  color: Color,
}

export const RibbonParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type RibbonParams = typeof RibbonParams;
export type RibbonProps = PD.Values<RibbonParams>

const RibbonVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<RibbonData, RibbonParams>) => ShapeRepresentation(getRibbonShape, Mesh.Utils)
}

function getRibbonMesh(data: RibbonData, props: RibbonProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  addRibbon(
    builderState,
    data.controlPoints,
    data.normalVectors,
    data.binormalVectors,
    data.linearSegments,
    data.widthValues,
    data.heightValues,
    data.arrowHeight
  );
  return MeshBuilder.getMesh(builderState);
}

function getRibbonShape(ctx: RuntimeContext, data: RibbonData, props: RibbonProps, shape?: Shape<Mesh>) {
    const geo = getRibbonMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => 1, () => data.label);
}

export type RibbonRepresentation = Representation<RibbonData, RibbonParams>

export function RibbonRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<RibbonData, RibbonParams>): RibbonRepresentation {
  return Representation.createMulti('ribbon', ctx, getParams, Representation.StateBuilder, RibbonVisuals as unknown as Representation.Def<RibbonData, RibbonParams>)
}

// Sheet Representation

interface SheetData {
  controlPoints: number[],
  normalVectors: number[],
  binormalVectors: number[],
  linearSegments: number,
  widthValues: number[],
  heightValues: number[],
  arrowHeight: number,
  startCap: boolean,
  endCap: boolean,
  label: string,
  color: Color,
}

export const SheetParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type SheetParams = typeof SheetParams;
export type SheetProps = PD.Values<SheetParams>

const SheetVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<SheetData, SheetParams>) => ShapeRepresentation(getSheetShape, Mesh.Utils)
}

function getSheetMesh(data: SheetData, props: SheetProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  addSheet(
    builderState,
    data.controlPoints,
    data.normalVectors,
    data.binormalVectors,
    data.linearSegments,
    data.widthValues,
    data.heightValues,
    data.arrowHeight,
    data.startCap,
    data.endCap
  );
  return MeshBuilder.getMesh(builderState);
}

function getSheetShape(ctx: RuntimeContext, data: SheetData, props: SheetProps, shape?: Shape<Mesh>) {
    const geo = getSheetMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => 1, () => data.label);
}

export type SheetRepresentation = Representation<SheetData, SheetParams>

export function SheetRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<SheetData, SheetParams>): SheetRepresentation {
  return Representation.createMulti('sheet', ctx, getParams, Representation.StateBuilder, SheetVisuals as unknown as Representation.Def<SheetData, SheetParams>)
}

// Tube Representation

interface TubeData {
  controlPoints: number[],
  normalVectors: number[],
  binormalVectors: number[],
  linearSegments: number,
  radialSegments: number,
  widthValues: number[],
  heightValues: number[],
  startCap: boolean,
  endCap: boolean,
  crossSection: 'elliptical' | 'rounded',
  roundCap: boolean,
  label: string,
  color: Color,
}

export const TubeParams = {
  ...Mesh.Params,
  doubleSided: PD.Boolean(true),
}
export type TubeParams = typeof TubeParams;
export type TubeProps = PD.Values<TubeParams>

const TubeVisuals = {
  'mesh': (ctx: RepresentationContext, getParams: RepresentationParamsGetter<TubeData, TubeParams>) => ShapeRepresentation(getTubeShape, Mesh.Utils)
}

function getTubeMesh(data: TubeData, props: TubeProps, mesh?: Mesh) {
  const builderState = MeshBuilder.createState(256, 128, mesh);
  builderState.currentGroup = 1;
  addTube(
    builderState,
    data.controlPoints,
    data.normalVectors,
    data.binormalVectors,
    data.linearSegments,
    data.radialSegments,
    data.widthValues,
    data.heightValues,
    data.startCap,
    data.endCap,
    data.crossSection,
    data.roundCap
  );
  return MeshBuilder.getMesh(builderState);
}

function getTubeShape(ctx: RuntimeContext, data: TubeData, props: TubeProps, shape?: Shape<Mesh>) {
    const geo = getTubeMesh(data, props, shape?.geometry);
    return Shape.create(data.label, data, geo, () => data.color, () => 1, () => data.label);
}

export type TubeRepresentation = Representation<TubeData, TubeParams>

export function TubeRepresentation(ctx: RepresentationContext, getParams: RepresentationParamsGetter<TubeData, TubeParams>): TubeRepresentation {
  return Representation.createMulti('tube', ctx, getParams, Representation.StateBuilder, TubeVisuals as unknown as Representation.Def<TubeData, TubeParams>)
}
