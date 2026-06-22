import { chromium } from 'playwright'
const errors = []
const b = await chromium.launch()
const p = await b.newPage()
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', e => errors.push('PE:' + e.message))
await p.goto('http://localhost:9112/', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2600)
await p.locator('.menu-btn').first().click(); await p.waitForTimeout(900)
const r = p.locator('.wildcard-page')
const HT = { HIGH:[5,1], PAIR:[10,2], TWOPAIR:[20,2], THREE:[30,3], STRAIGHT:[30,4], FLUSH:[35,4], FULL:[40,4], FOUR:[60,7], SF:[100,8] }
const cv = x => (x>=11&&x<=13)?10 : x===14?11 : x
function straight(cs){ const rs=[...new Set(cs.map(c=>c.rank))]; if(rs.length!==5)return false; rs.sort((a,b)=>a-b); if(rs[4]-rs[0]===4)return true; return rs[0]===2&&rs[1]===3&&rs[2]===4&&rs[3]===5&&rs[4]===14 }
function evalBase(cs){ const byR={}; cs.forEach(c=>{(byR[c.rank]=byR[c.rank]||[]).push(c)}); const g=Object.values(byR).sort((a,b)=>b.length-a.length); const fl=cs.length===5&&cs.every(c=>c.suit===cs[0].suit); const st=cs.length===5&&straight(cs); const four=g.find(x=>x.length===4),three=g.find(x=>x.length===3),twos=g.filter(x=>x.length===2); let key,sc; if(fl&&st){key='SF';sc=cs}else if(four){key='FOUR';sc=four}else if(three&&twos.length){key='FULL';sc=cs}else if(fl){key='FLUSH';sc=cs}else if(st){key='STRAIGHT';sc=cs}else if(three){key='THREE';sc=three}else if(twos.length>=2){key='TWOPAIR';sc=[...twos[0],...twos[1]]}else if(twos.length){key='PAIR';sc=twos[0]}else{key='HIGH';sc=[cs.reduce((a,b)=>b.rank>a.rank?b:a)]} let [chips,mult]=HT[key]; sc.forEach(c=>chips+=cv(c.rank)); return {key,total:chips*mult} }
function combos(arr,k){ const res=[]; const rec=(s,c)=>{ if(c.length===k){res.push(c);return} for(let i=s;i<arr.length;i++)rec(i+1,[...c,arr[i]]) }; rec(0,[]); return res }
function best(cards){ let bst={total:-1,idx:[]}; for(let k=1;k<=5;k++) for(const cmb of combos(cards.map((c,i)=>({...c,i})),k)){ const e=evalBase(cmb); if(e.total>bst.total) bst={total:e.total,key:e.key,idx:cmb.map(c=>c.i)} } return bst }
const readHand = () => p.$$eval('.card', els => els.map(e => ({ rankL:e.querySelector('.rank').textContent.trim(), suitL:e.querySelector('.suit').textContent.trim() })))
function parse(h){ const RM={A:14,K:13,Q:12,J:11},SM={'♠':0,'♥':1,'♦':2,'♣':3}; return h.map(c=>({rank:RM[c.rankL]||+c.rankL, suit:SM[c.suitL]})) }
async function clickCards(idx){ const cards=await p.$$('.card'); for(const i of idx) await cards[i].click() }
// keep biggest suit group for flush-chase; discard the rest (max 5)
function fishIdx(cards){ const bySuit={}; cards.forEach((c,i)=>{(bySuit[c.suit]=bySuit[c.suit]||[]).push(i)}); const keep=Object.values(bySuit).sort((a,b)=>b.length-a.length)[0]; const discard=cards.map((c,i)=>i).filter(i=>!keep.includes(i)); return discard.slice(0,5) }

async function clearBlind(maxTurns){
  for(let t=0;t<maxTurns;t++){
    if(await r.getAttribute('data-state')!=='playing') return await r.getAttribute('data-state')
    const cards=parse(await readHand()); const bst=best(cards)
    const need=(+(await r.getAttribute('data-target')))-(+(await r.getAttribute('data-score')))
    const hands=+(await r.getAttribute('data-hands')); const discards=+(await r.getAttribute('data-discards'))
    if(bst.total<need && hands>1 && discards>0 && bst.key!=='FLUSH' && bst.key!=='SF' && bst.key!=='FULL'){
      await clickCards(fishIdx(cards)); await p.locator('.act.discard').click(); await p.waitForTimeout(220); continue
    }
    await clickCards(bst.idx); await p.waitForTimeout(120); await p.locator('.act.play').click(); await p.waitForTimeout(260)
  }
  return await r.getAttribute('data-state')
}
console.log('start ante', await r.getAttribute('data-ante'), 'target', await r.getAttribute('data-target'))
let st = await clearBlind(20)
console.log('blind 1 result:', st, 'score', await r.getAttribute('data-score'))
let reachedShop=false, advanced=false
if(st==='shop'){
  reachedShop=true
  console.log('SHOP offers', await p.$$eval('.offer',e=>e.length), 'money', await r.getAttribute('data-money'))
  const buys=await p.$$('.buy:not([disabled])')
  if(buys.length){ await buys[0].click(); await p.waitForTimeout(250); console.log('bought -> jokers', await r.getAttribute('data-jokers')) }
  await p.locator('.shop-actions .q-btn.bg-primary').click(); await p.waitForTimeout(700)
  const ai=await r.getAttribute('data-ante'), bi=await r.getAttribute('data-blindindex'), s2=await r.getAttribute('data-state')
  console.log('after next: ante', ai, 'blindIndex', bi, 'state', s2, 'target', await r.getAttribute('data-target'))
  advanced = (s2==='playing' && bi==='1')
  // play big blind a couple turns to confirm scoring continues
  await clearBlind(6)
  console.log('big blind progressed: score', await r.getAttribute('data-score'), 'state', await r.getAttribute('data-state'))
}
console.log('REACHED_SHOP', reachedShop, '| ADVANCED_TO_BIG_BLIND', advanced)
console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0,4)) : 'none')
await b.close()
