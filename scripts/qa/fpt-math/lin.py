import docx,sys
from docx.table import Table
from docx.text.paragraph import Paragraph
def lin(path):
    d=docx.Document(path);out=[]
    for el in d.element.body.iterchildren():
        tag=el.tag.split('}')[1]
        if tag=='p':
            t=Paragraph(el,d).text.strip()
            if t: out.append(t)
        elif tag=='tbl':
            tb=Table(el,d)
            for r in tb.rows:
                seen=[]
                for c in r.cells:
                    if c._tc in seen: continue
                    seen.append(c._tc); t=c.text.strip()
                    if t: out.append("[T] "+t.replace("\n"," ⏎ "))
    return out
if __name__=="__main__":
    for l in lin(sys.argv[1]): print(l)
