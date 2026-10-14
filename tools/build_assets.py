# Builds public/assets/core.glb and scenery.glb from the source models in art/source-glb/.
# One file for the whole game: every model scaled to game units (metres), origin at the bottom centre,
# meshes joined per model, textures shrunk, extra maps (normal/specular/emission) dropped.
#
# usage:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_assets.py -- art/source-glb public/assets
#
# Axes: Blender +Y is the running direction (three.js -Z); Blender Z is up.
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix

SRC, OUT = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.image_settings.quality = 82


def log(*a):
    print("ASSET", *a)


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name))
    return [o for o in bpy.data.objects if o not in before]


def select_only(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def bbox(objs):
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        n = len(o.data.vertices)
        co = np.empty(n * 3, np.float32); o.data.vertices.foreach_get("co", co); co = co.reshape(n, 3)
        co = co @ np.array(o.matrix_world.to_3x3()).T + np.array(o.matrix_world.translation)
        lo = Vector(map(min, lo, co.min(0))); hi = Vector(map(max, hi, co.max(0)))
    return lo, hi


def simple_material(m, tex_size, keep_alpha=False):
    """Rebuild a material as Principled + base colour texture only (or flat colour)."""
    if not m.use_nodes:
        return
    nt = m.node_tree
    img = None
    # base colour texture, else whatever texture drives emission (house2 is emission-only)
    for l in nt.links:
        if l.from_node.type == "TEX_IMAGE" and l.to_socket.name in ("Base Color", "Color") and l.to_node.type in ("BSDF_PRINCIPLED", "EMISSION"):
            img = l.from_node.image; break
    if img is None:
        for l in nt.links:
            if l.from_node.type == "TEX_IMAGE" and l.to_socket.name == "Emission":
                img = l.from_node.image; break
    old = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    col = tuple(old.inputs["Base Color"].default_value) if old else (0.8, 0.8, 0.8, 1)
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Specular"].default_value = 0.2
    b.inputs["Base Color"].default_value = col
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    if img is not None:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        if keep_alpha:
            nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
        if max(img.size) > tex_size:
            w, h = img.size
            k = tex_size / max(w, h)
            img.scale(max(4, int(w * k)), max(4, int(h * k)))
        img.file_format = "PNG" if keep_alpha else "JPEG"
    m.blend_method = "BLEND" if keep_alpha else "OPAQUE"


def finish_prop(objs, name, rot_z=0.0, height=None, size=None, max_tris=None, tex=256, drop_mats=()):
    """Join meshes, rotate, scale (uniform by height, or per-axis by size=(x,y,z)), bottom-centre origin."""
    meshes = [o for o in objs if o.type == "MESH"]
    # remove faces using unwanted materials (glass etc.)
    for o in meshes:
        bad = [i for i, s in enumerate(o.material_slots) if s.material and any(d in s.material.name for d in drop_mats)]
        if bad:
            bm = bmesh.new(); bm.from_mesh(o.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in bad], context="FACES")
            bm.to_mesh(o.data); bm.free()
    select_only(meshes)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for o in objs:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    select_only(meshes)
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name; o.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if rot_z:
        o.data.transform(Matrix.Rotation(rot_z, 4, "Z"))
    # keep only the first uv map
    while len(o.data.uv_layers) > 1:
        o.data.uv_layers.remove(o.data.uv_layers[-1])
    for a in list(o.data.color_attributes):
        o.data.color_attributes.remove(a)
    # drop unused material slots
    bpy.ops.object.material_slot_remove_unused()
    if max_tris and tris_of(o) > max_tris:
        before = tris_of(o)
        m = o.modifiers.new("less", "DECIMATE"); m.ratio = max_tris / before
        bpy.ops.object.modifier_apply(modifier=m.name)
        log(name, "decimated", before, "->", tris_of(o))
    lo, hi = bbox([o])
    o.data.transform(Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    dims = hi - lo
    if size:
        sx, sy, sz = [(s / d if s else None) for s, d in zip(size, dims)]
        k = next(v for v in (sz, sx, sy) if v)
        o.data.transform(Matrix.Diagonal(Vector((sx or k, sy or k, sz or k, 1))))
    elif height:
        k = height / dims.z
        o.data.transform(Matrix.Scale(k, 4))
    o.location = (0, 0, 0)
    for s in o.material_slots:
        if s.material:
            simple_material(s.material, tex)
    # smooth shading with sharp edges kept: shares vertices (smaller file) and decimated walls stay flat
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(35)
    lo, hi = bbox([o])
    log(name, "tris", tris_of(o), "size", [round(v, 2) for v in (hi - lo)], "mats", len(o.material_slots))
    return o


# ---------------------------------------------------------------- props
finish_prop(import_glb("train.glb"), "train", size=(2.3, None, None), rot_z=0, tex=256)
finish_prop(import_glb("coin.glb"), "coin", size=(0.8, None, 0.8), tex=128)
finish_prop(import_glb("cement_roadblock.glb"), "low", size=(2.2, 0.7, 0.95), tex=256)
finish_prop(import_glb("hurdle.glb"), "hurdle", size=(2.3, 0.35, 1.25), tex=8)
# overhead gate: tall hurdle posts + a striped panel (the red/white roadblock) from 1.1 m to 2.6 m
posts = finish_prop(import_glb("hurdle.glb"), "posts", size=(2.4, 0.3, 2.65), tex=8)
panel = finish_prop(import_glb("roadblock.glb"), "panel", size=(2.3, 0.35, 1.45), tex=256)
panel.data.transform(Matrix.Translation((0, 0, 1.15)))
select_only([posts, panel], panel)
bpy.ops.object.join()
gate = bpy.context.view_layer.objects.active
gate.name = "overhead"; gate.data.name = "overhead"
log("overhead tris", tris_of(gate))

# ---------------------------------------------------------------- houses (front faces Blender -Y = three +Z)
finish_prop(import_glb("house1.glb"), "house1", rot_z=0, height=9.5, max_tris=2500, tex=512)
finish_prop(import_glb("house2.glb"), "house2", rot_z=0, height=10.0, max_tris=5000, tex=512, drop_mats=("CRN.",))
finish_prop(import_glb("house3.glb"), "house3", rot_z=0, height=12.0, max_tris=3500, tex=512)
finish_prop(import_glb("house4.glb"), "house4", rot_z=3 * math.pi / 2, height=8.5, tex=256)
finish_prop(import_glb("house5.glb"), "house5", rot_z=3 * math.pi / 2, height=8.0, max_tris=3000, tex=512)

# ---------------------------------------------------------------- player (skinned, keeps its animations)
objs = import_glb("player1.glb")
arm = next(o for o in objs if o.type == "ARMATURE")
arm.name = "player"
face = [o for o in objs if o.type == "MESH" and "Body" not in o.name]
body = next(o for o in objs if o.type == "MESH" and "Body" in o.name)
for o in [body] + face:
    # keep the uv map the textures use (the render-active one)
    keep = next((u.name for u in o.data.uv_layers if u.active_render), o.data.uv_layers[0].name)
    for nm in [u.name for u in o.data.uv_layers if u.name != keep]:
        o.data.uv_layers.remove(o.data.uv_layers[nm])
for s in body.material_slots:
    simple_material(s.material, 512)
# the face parts use a few small regions of a 4096 px atlas: crop that region and remap the uvs
fimg = None
for s in face[0].material_slots:
    for n in s.material.node_tree.nodes:
        if n.type == "TEX_IMAGE":
            fimg = n.image
us, vs = [], []
for o in face:
    uv = o.data.uv_layers[0].data
    for d in uv:
        us.append(d.uv[0]); vs.append(d.uv[1])
u0, u1, v0, v1 = max(0, min(us)), min(1, max(us)), max(0, min(vs)), min(1, max(vs))
log("face uv box", round(u0, 3), round(u1, 3), round(v0, 3), round(v1, 3))
W, H = fimg.size
px = np.empty(W * H * 4, np.float32); fimg.pixels.foreach_get(px); px = px.reshape(H, W, 4)
x0, x1 = int(u0 * W) - 4, int(math.ceil(u1 * W)) + 4
y0, y1 = int(v0 * H) - 4, int(math.ceil(v1 * H)) + 4
x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
crop = px[y0:y1, x0:x1].copy()
cw, ch = x1 - x0, y1 - y0
new = bpy.data.images.new("face", cw, ch, alpha=True)
new.pixels.foreach_set(crop.ravel())
side = 1024
k = side / max(cw, ch)
new.scale(max(8, int(cw * k)), max(8, int(ch * k)))
new.file_format = "PNG"; new.pack()
for o in face:
    for d in o.data.uv_layers[0].data:
        d.uv = ((d.uv[0] * W - x0) / cw, (d.uv[1] * H - y0) / ch)
    for s in o.material_slots:
        for n in s.material.node_tree.nodes:
            if n.type == "TEX_IMAGE":
                n.image = new
        simple_material(s.material, side, keep_alpha=True)
log("face crop", cw, ch, "->", tuple(new.size))
# animations: keep what the game uses
KEEP = ("idle", "run", "jump", "jumpup", "fall", "roll", "die", "runlookback")
for t in list(arm.animation_data.nla_tracks):
    base = t.name.replace("_Armature", "")
    if base not in KEEP:
        arm.animation_data.nla_tracks.remove(t)
for a in list(bpy.data.actions):
    if a.name.replace("_Armature", "") not in KEEP:
        bpy.data.actions.remove(a)
for t in arm.animation_data.nla_tracks:
    t.name = t.name.replace("_Armature", "")
log("player tris", sum(tris_of(o) for o in [body] + face), "actions", [t.name for t in arm.animation_data.nla_tracks])

# ---------------------------------------------------------------- cleanup + export
for img in list(bpy.data.images):
    if img.users == 0:
        bpy.data.images.remove(img)
for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)
for img in bpy.data.images:
    log("image", img.name, tuple(img.size), img.file_format)
os.makedirs(OUT, exist_ok=True)
# two files: what the first screen needs (runner, track props, coin), and the houses, which load in the background
GROUPS = {
    "core.glb": ["player", "train", "coin", "low", "hurdle", "overhead"],  # the ramp is built in code
    "scenery.glb": ["house1", "house2", "house3", "house4", "house5"],
}
for fname, names in GROUPS.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        top = o
        while top.parent:
            top = top.parent
        if top.name in names:
            o.select_set(True)
    path = os.path.join(OUT, fname)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_image_format="AUTO", use_selection=True,
        export_apply=True, export_animations=True, export_nla_strips=True,
        export_frame_step=int(os.environ.get("STEP", "2")), export_optimize_animation_size=True,
        export_def_bones=False, export_colors=False, export_tangents=False,
        export_draco_mesh_compression_enable=False,
    )
    log("wrote", path, round(os.path.getsize(path) / 1024), "KB")
