import math, random, sys
from PIL import Image, ImageDraw, ImageFilter
S=1024
def background(size=S):
    bg=Image.new('RGBA',(size,size))
    px=bg.load(); c=size/2
    a=(255,150,205); b=(118,52,190)
    for y in range(size):
        for x in range(size):
            d=min(1,math.hypot(x-c,y-c*1.05)/(size*0.62))
            px[x,y]=tuple(int(a[i]+(b[i]-a[i])*d) for i in range(3))+(255,)
    # soft rays from the box
    rays=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(rays)
    cx,cy=size/2,size*0.52
    for i in range(14):
        ang=i/14*2*math.pi+0.1; w=0.09
        pts=[(cx,cy),(cx+math.cos(ang-w)*size,cy+math.sin(ang-w)*size),(cx+math.cos(ang+w)*size,cy+math.sin(ang+w)*size)]
        d.polygon(pts,fill=(255,236,150,46 if i%2 else 70))
    rays=rays.filter(ImageFilter.GaussianBlur(size/90))
    bg.alpha_composite(rays)
    glow=Image.new('RGBA',(size,size),(0,0,0,0)); ImageDraw.Draw(glow).ellipse([cx-size*0.3,cy-size*0.3,cx+size*0.3,cy+size*0.3],fill=(255,240,180,120))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size/12)))
    # sparkle stars
    random.seed(4); st=ImageDraw.Draw(bg)
    for (x,y,r) in [(0.18,0.2,0.045),(0.83,0.17,0.06),(0.86,0.62,0.035),(0.13,0.66,0.04),(0.7,0.08,0.025),(0.28,0.1,0.025)]:
        x*=size;y*=size;r*=size
        pts=[]
        for k in range(8):
            rr=r if k%2==0 else r*0.28; an=k*math.pi/4-math.pi/2
            pts.append((x+math.cos(an)*rr,y+math.sin(an)*rr))
        st.polygon(pts,fill=(255,247,200,255))
    return bg
def fg(seed, scale):
    im=Image.open(f'shots/icon_{seed}.png'); im=im.crop(im.getbbox())
    w=int(S*scale); h=int(im.height*w/im.width); im=im.resize((w,h),Image.LANCZOS)
    layer=Image.new('RGBA',(S,S),(0,0,0,0))
    # a dark soft shadow under the box
    sh=Image.new('RGBA',(S,S),(0,0,0,0)); ImageDraw.Draw(sh).ellipse([S/2-w*0.42,(S+h)/2+S*0.02-30,S/2+w*0.42,(S+h)/2+S*0.02+30],fill=(60,20,90,110))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    layer.alpha_composite(im,((S-w)//2,(S-h)//2+int(S*0.02)))
    return layer
def rounded(im, r):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).rounded_rectangle([0,0,im.width-1,im.height-1],r,fill=255)
    o=im.copy(); o.putalpha(m); return o
def circle(im):
    m=Image.new('L',im.size,0); ImageDraw.Draw(m).ellipse([0,0,im.width-1,im.height-1],fill=255)
    o=im.copy(); o.putalpha(m); return o
if __name__=='__main__':
    seed=int(sys.argv[1])
    bg=background(); f=fg(seed,0.86)
    full=bg.copy(); full.alpha_composite(f); full.save(f'ikona/full_{seed}.png')
