from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
SRC='public/theme/crackfarm/multi_2x.png'
OUT=r"C:\Users\noski\AppData\Local\Temp\claude\C--Users-noski-Downloads-GENERATOR-PREVIEW\162f4280-0c27-4439-a588-97692d7bd148\scratchpad\rings"
os.makedirs(OUT, exist_ok=True)
base=Image.open(SRC).convert('RGBA'); W,H=base.size
blank=base.copy(); d=ImageDraw.Draw(blank)
cx,cy=238,224
d.ellipse([cx-158,cy-150,cx+158,cy+150], fill=(84,70,45,255))
sh=Image.new('RGBA',(W,H),(0,0,0,0)); ds=ImageDraw.Draw(sh)
ds.ellipse([cx-158,cy-150,cx+158,cy+150], fill=(0,0,0,60))
blank=Image.alpha_composite(blank, sh.filter(ImageFilter.GaussianBlur(40)))
FONT=r"C:\Windows\Fonts\ariblk.ttf"
GREEN=(150,240,74,255); GLOW=(120,255,60,255); STROKE=(10,18,4,255)
def fit(txt,maxw,maxh):
    for s in range(220,40,-4):
        f=ImageFont.truetype(FONT,s); b=f.getbbox(txt)
        if b[2]-b[0]<=maxw and b[3]-b[1]<=maxh: return f,b
    f=ImageFont.truetype(FONT,44); return f,f.getbbox(txt)
def make(val):
    txt=f"{val}x"; f,b=fit(txt,250,150)
    w,h=b[2]-b[0],b[3]-b[1]; tx=cx-w//2-b[0]; ty=cy-h//2-b[1]
    img=blank.copy()
    gl=Image.new('RGBA',(W,H),(0,0,0,0)); ImageDraw.Draw(gl).text((tx,ty),txt,font=f,fill=GLOW)
    img=Image.alpha_composite(img, gl.filter(ImageFilter.GaussianBlur(9)))
    ImageDraw.Draw(img).text((tx,ty),txt,font=f,fill=GREEN,stroke_width=max(5,f.size//14),stroke_fill=STROKE)
    img.save(os.path.join(OUT,f"multi_{val}x.png"))
for v in [4,8,16,32,64,128,256,512]: make(v)
print("OK", sorted(os.listdir(OUT)))
