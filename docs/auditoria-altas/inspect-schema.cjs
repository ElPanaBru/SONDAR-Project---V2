const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const backendRequire = createRequire(path.resolve(__dirname, '../../Backend/package.json'));
backendRequire('dotenv').config({path:path.resolve(__dirname,'../../Backend/.env'), quiet:true});
const {Client}=backendRequire('pg');
(async()=>{
 const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:8000,statement_timeout:15000});
 try {
 await c.connect(); await c.query('BEGIN READ ONLY');
 const result={};
 for(const [name,sql] of Object.entries({
 tables: "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
 columns: "SELECT table_name,column_name,data_type,is_nullable,column_default,character_maximum_length FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
 constraints: "SELECT c.relname AS table_name,con.conname,con.contype,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname",
 indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
 triggers: "SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name",
 policies: "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname"
 })) result[name]=(await c.query(sql)).rows;
 result.integrity=(await c.query(`
 SELECT
 (SELECT count(*)::int FROM reel_comments c JOIN reel_comments p ON p.id=c.parent_id WHERE c.reel_id<>p.reel_id) AS reel_cross_parent,
 (SELECT count(*)::int FROM comunidad_comentarios c JOIN comunidad_comentarios p ON p.id=c.parent_id WHERE c.publicacion_id<>p.publicacion_id) AS community_cross_parent,
 (SELECT count(*)::int FROM eventos WHERE trim(titulo)='' OR latitud NOT BETWEEN -90 AND 90 OR longitud NOT BETWEEN -180 AND 180) AS invalid_events,
 (SELECT count(*)::int FROM reels WHERE trim(titulo)='' OR fragment_start<0 OR fragment_end<=fragment_start OR fragment_end-fragment_start>30) AS invalid_reels,
 (SELECT count(*)::int FROM reels r WHERE likes<>(SELECT count(*) FROM reel_likes l WHERE l.reel_id=r.id)) AS reel_like_count_mismatch,
 (SELECT count(*)::int FROM reels r WHERE guardados<>(SELECT count(*) FROM reel_saves s WHERE s.reel_id=r.id)) AS reel_save_count_mismatch,
 (SELECT count(*)::int FROM reels r WHERE visitas<>(SELECT count(*) FROM reel_views v WHERE v.reel_id=r.id)) AS reel_view_count_mismatch,
 (SELECT count(*)::int FROM reels r WHERE compartidos<>(SELECT count(*) FROM reel_shares s WHERE s.reel_id=r.id)) AS reel_share_count_mismatch,
 (SELECT count(*)::int FROM comunidad_publicaciones p WHERE likes<>(SELECT count(*) FROM comunidad_publicacion_likes l WHERE l.publicacion_id=p.id)) AS community_like_count_mismatch,
 (SELECT count(*)::int FROM comunidad_publicaciones p WHERE guardados<>(SELECT count(*) FROM comunidad_publicacion_guardados g WHERE g.publicacion_id=p.id)) AS community_save_count_mismatch,
 (SELECT count(*)::int FROM reels r WHERE audio_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='reels' AND o.name=r.audio_path)) AS reel_missing_audio_object,
 (SELECT count(*)::int FROM users u WHERE profile_img_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='perfiles' AND o.name=u.profile_img_path)) AS profile_missing_avatar_object
 `)).rows[0];
 result.trigger_functions=(await c.query("SELECT proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN ('sincronizar_ubicacion_evento','crear_publicacion_automatica_perfil','validar_padre_respuesta_perfil')")).rows;
 await c.query('ROLLBACK');
 fs.writeFileSync(path.join(__dirname,'schema-evidence.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,Array.isArray(v)?v.length:v]))));
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.name,e.message);process.exitCode=1});
