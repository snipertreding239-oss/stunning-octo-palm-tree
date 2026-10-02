'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const app = express();
const root = __dirname;
const data = path.join(root, 'private-pdfs');
const index = path.join(data, 'index.json');
fs.mkdirSync(data, {recursive:true});
const admin = process.env.ADMIN_PASSWORD;
const member = process.env.MEMBER_PASSWORD;
const secret = process.env.SESSION_SECRET;
if (!admin || !member || !secret || admin.length < 12 || member.length < 12 || secret.length < 32 || admin === member) {
  console.error('Set distinct ADMIN_PASSWORD and MEMBER_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters).'); process.exit(1);
}
const read = () => JSON.parse(fs.readFileSync(index, 'utf8'));
if (!fs.existsSync(index)) fs.writeFileSync(index, '[]');
const save = items => {const tmp=index+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(items)); fs.renameSync(tmp,index);};
const sign = value => crypto.createHmac('sha256',secret).update(value).digest('hex');
function cookie(role){const until=Date.now()+8*3600000, value=`${role}.${until}`, token=`${value}.${sign(value)}`;return `sajith_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`;}
function auth(req,res,next){
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sajith_session='));
 const parts=raw?.slice(15).split('.')||[];
 const value=`${parts[0]}.${parts[1]}`;
 if(parts.length!==3 || !['admin','member'].includes(parts[0]) || !Number.isFinite(Number(parts[1])) || Number(parts[1])<Date.now() || !/^[a-f0-9]{64}$/.test(parts[2]) || !crypto.timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(sign(value),'hex'))) return res.status(401).json({error:'Password එක ඇතුළත් කරන්න.'});
 req.role=parts[0];next();
}
function adminOnly(req,res,next){if(req.role!=='admin')return res.status(403).json({error:'Admin පමණි.'});next();}
app.disable('x-powered-by');
app.use(express.json({limit:'16kb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
const attempts=new Map();
app.post('/api/login',(req,res)=>{
 const ip=req.ip, state=attempts.get(ip)||{count:0,until:0};
 if(state.until>Date.now())return res.status(429).json({error:'මිනිත්තු 15කින් නැවත උත්සාහ කරන්න.'});
 const entered=String(req.body.password||'');
 const equal=(a,b)=>{const ah=crypto.createHash('sha256').update(a).digest(),bh=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(ah,bh);};
 let role=equal(entered,admin)?'admin':equal(entered,member)?'member':null;
 if(!role){state.count++;if(state.count>=10){state.until=Date.now()+15*60000;state.count=0;}attempts.set(ip,state);return res.status(401).json({error:'වැරදි password එකක්.'});}
 attempts.delete(ip);res.setHeader('Set-Cookie',cookie(role));res.json({role});
});
app.post('/api/logout',(req,res)=>{res.setHeader('Set-Cookie','sajith_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');res.json({ok:true});});
app.get('/api/me',auth,(req,res)=>res.json({role:req.role}));
app.get('/api/pdfs',auth,(req,res)=>res.json(read().map(({id,title,size,createdAt})=>({id,title,size,createdAt}))));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,file.mimetype==='application/pdf'&&path.extname(file.originalname).toLowerCase()==='.pdf')});
app.post('/api/pdfs',auth,adminOnly,upload.single('pdf'),(req,res)=>{
 if(!req.file || req.file.buffer.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'වලංගු PDF ගොනුවක් තෝරන්න.'});
 const title=String(req.body.title||req.file.originalname).trim().slice(0,150);
 const id=crypto.randomUUID(),item={id,title,size:req.file.size,createdAt:Date.now()};
 fs.writeFileSync(path.join(data,id+'.pdf'),req.file.buffer,{flag:'wx'});try{const items=read();items.push(item);save(items);}catch(e){fs.unlinkSync(path.join(data,id+'.pdf'));throw e;}
 res.status(201).json(item);
});
app.get('/api/pdfs/:id/file',auth,(req,res)=>{
 const item=read().find(x=>x.id===req.params.id);if(!item)return res.sendStatus(404);
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`inline; filename="document.pdf"`);res.setHeader('Cache-Control','private, no-store');res.sendFile(path.join(data,item.id+'.pdf'));
});
app.delete('/api/pdfs/:id',auth,adminOnly,(req,res)=>{
 const items=read(),item=items.find(x=>x.id===req.params.id);if(!item)return res.sendStatus(404);
 save(items.filter(x=>x.id!==item.id));try{fs.unlinkSync(path.join(data,item.id+'.pdf'));}catch(e){if(e.code!=='ENOENT')throw e;}res.json({ok:true});
});
app.get('/',(req,res)=>res.sendFile(path.join(root,'index.html')));

// Separate class PDF collection; existing PDF routes and files are untouched.
const classesData = path.join(root, 'private-class-pdfs');
const classesIndex = path.join(classesData, 'index.json');
fs.mkdirSync(classesData, {recursive:true});
if (!fs.existsSync(classesIndex)) fs.writeFileSync(classesIndex, '[]');
const readClasses = () => JSON.parse(fs.readFileSync(classesIndex, 'utf8'));
const saveClasses = items => { const tmp=classesIndex+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(items)); fs.renameSync(tmp,classesIndex); };
app.get('/api/classes',auth,(req,res)=>res.json(readClasses().map(({id,title,size,createdAt})=>({id,title,size,createdAt}))));
app.post('/api/classes',auth,adminOnly,upload.single('pdf'),(req,res)=>{
 if(!req.file || req.file.buffer.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'වලංගු PDF ගොනුවක් තෝරන්න.'});
 const title=String(req.body.title||req.file.originalname).trim().slice(0,150);
 const id=crypto.randomUUID(), item={id,title,size:req.file.size,createdAt:Date.now()};
 fs.writeFileSync(path.join(classesData,id+'.pdf'),req.file.buffer,{flag:'wx'});
 try{const items=readClasses();items.push(item);saveClasses(items);}catch(e){fs.unlinkSync(path.join(classesData,id+'.pdf'));throw e;}
 res.status(201).json(item);
});
app.get('/api/classes/:id/file',auth,(req,res)=>{
 const item=readClasses().find(x=>x.id===req.params.id);if(!item)return res.sendStatus(404);
 res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','inline; filename="class-document.pdf"');res.setHeader('Cache-Control','private, no-store');res.sendFile(path.join(classesData,item.id+'.pdf'));
});
app.delete('/api/classes/:id',auth,adminOnly,(req,res)=>{
 const items=readClasses(),item=items.find(x=>x.id===req.params.id);if(!item)return res.sendStatus(404);
 saveClasses(items.filter(x=>x.id!==item.id));try{fs.unlinkSync(path.join(classesData,item.id+'.pdf'));}catch(e){if(e.code!=='ENOENT')throw e;}res.json({ok:true});
});
app.use((err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:'PDF එක 25 MB ට අඩු විය යුතුයි.'});console.error(err);res.status(500).json({error:'Server දෝෂයක්.'});});
app.listen(process.env.PORT||3000,()=>console.log('Site ready on port '+(process.env.PORT||3000)));
