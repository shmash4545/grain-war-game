import { describe, it, expect } from 'vitest';
import { createGame, start, action, submit, reveal, advance, monthTotal, score } from './gameEngine';
function complete(g: ReturnType<typeof createGame>, boxes=0) { for(let i=0;i<g.cities.length;i++) g=submit(g,i,Math.min(boxes,g.cities[i].stock)); return reveal(g); }
describe('城市經營規則',()=>{
 for(const n of [2,3,4,5,6]) it(`${n} 城八週完整流程與月結`,()=>{let g=start(createGame(n));for(let w=1;w<=8;w++){expect(g.week).toBe(w);g=complete(g,6);expect(g.cities[0].reports).toHaveLength(w);g=advance(g);}expect(g.phase).toBe('final');expect(g.cities[0].reports.reduce((s,r)=>s+r.shortage,0)).toBeGreaterThan(0);expect(Number.isFinite(score(g.cities[0]).total)).toBe(true);expect(()=>advance(g)).toThrow();});
 it('四次採買共用四次行動，不能再採買或播種',()=>{let g=start(createGame(2));for(let i=0;i<4;i++)g=action(g,0,'buy');expect(g.cities[0].stock).toBe(16);expect(g.cities[0].remaining).toBe(0);expect(()=>action(g,0,'buy')).toThrow();expect(()=>action(g,0,'till',0)).toThrow();});
 it('同週不可照料且不扣資源；下週照料、第三週收成且只結算一次',()=>{let g=start(createGame(2));expect(()=>action(g,0,'care',0)).toThrow();g=action(g,0,'till',0);const snapshot=structuredClone(g);expect(()=>action(g,0,'care',0)).toThrow();expect(g).toEqual(snapshot);expect(g.cities[0].fields[0].plantedWeek).toBe(1);g=advance(complete(g));expect(g.cities[0].stock).toBe(8);g=action(g,0,'care',0);expect(()=>action(g,0,'care',0)).toThrow();g=advance(complete(g));expect(g.cities[0].stock).toBe(15);expect(g.cities[0].fields[0]).toEqual({state:'empty'});g=advance(complete(g));expect(g.cities[0].stock).toBe(15);g=action(g,0,'till',0);expect(()=>action(g,0,'care',0)).toThrow();});
 it('事件多出行動仍最多採買四次',()=>{let g=start(createGame(2));while(g.week<7)g=advance(complete(g));for(let i=0;i<4;i++)g=action(g,0,'buy');expect(g.cities[0].remaining).toBe(1);expect(()=>action(g,0,'buy')).toThrow();g=action(g,0,'till',0);expect(g.cities[0].remaining).toBe(0);});
 it('可跨週照料，缺交後可用收成翻身',()=>{let g=action(start(createGame(2)),0,'till',0);g=advance(complete(g,6));g=action(g,0,'care',0);g=advance(complete(g,2));expect(g.cities[0].stock).toBe(7);g=complete(g,6);expect(g.cities[0].reports.map(r=>r.shortage)).toEqual([0,4,0]);});
 it('交付即扣庫存，禁止超額、小數、重複提交及提前揭曉',()=>{let g=start(createGame(2));for(const n of [-1,9,1.5,NaN]) expect(()=>submit(g,0,n)).toThrow();g=submit(g,0,6);expect(g.cities[0].stock).toBe(2);expect(()=>submit(g,0,0)).toThrow();expect(()=>action(g,0,'buy')).toThrow();expect(()=>reveal(g)).toThrow();g=reveal(submit(g,1,0));expect(()=>reveal(g)).toThrow();expect(g.cities[0].reports).toHaveLength(1);});
 it('月度交付分帳與事件週初生效',()=>{let g=start(createGame(2));for(let w=1;w<=8;w++){g=action(g,0,'buy');g=action(g,0,'buy');if(w===6)expect(g.cities[0].stock).toBeGreaterThanOrEqual(6);g=complete(g,6);if(w===4)expect(monthTotal(g.cities[0],0)).toBe(24);g=advance(g);}expect(monthTotal(g.cities[0],1)).toBe(18);});
 it('無效城市數與階段操作被拒絕',()=>{for(const n of [1,7,2.5])expect(()=>createGame(n)).toThrow();const g=createGame(2);expect(()=>action(g,0,'buy')).toThrow();expect(()=>advance(g)).toThrow();});
});

describe('暫行計分可解釋性',()=>{
 it('滿目標、超額、產能與韌性各自封頂，總分最高 100',()=>{
 const c=createGame(2).cities[0];c.stock=100;c.reports=Array.from({length:8},(_,i)=>({week:i+1,delivered:20,shortage:0,stock:100,harvest:0,logs:[]}));
 expect(score(c)).toEqual({delivery:35,growth:25,reserve:25,resilience:15,total:100});
 });
 it('缺交每箱扣韌性一分，最低零；無交付不取得月目標及超額分',()=>{
 const c=createGame(2).cities[0];c.stock=0;c.reports=Array.from({length:8},(_,i)=>({week:i+1,delivered:0,shortage:6,stock:0,harvest:0,logs:[]}));expect(score(c).total).toBe(0);
 });
 it('事件只改當週行動／採買，之後恢復基本值',()=>{
 let g=start(createGame(2));while(g.week<6)g=advance(complete(g));const stock=g.cities[0].stock;g=action(g,0,'buy');expect(g.cities[0].stock-stock).toBe(3);g=advance(complete(g));expect(g.cities[0].remaining).toBe(5);g=advance(complete(g));expect(g.cities[0].remaining).toBe(4);const before=g.cities[0].stock;g=action(g,0,'buy');expect(g.cities[0].stock-before).toBe(2);
 });
});
