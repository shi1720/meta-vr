import {test,expect} from '@playwright/test';
test('dictionary search, empty state and 3D controls',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/dictionary');
 await page.getByRole('searchbox').fill('zzzzzz');await expect(page.locator('.sign-card')).toHaveCount(0);
 await page.getByRole('searchbox').fill('hello');await page.locator('a[href="#/dictionary/hello"]').click();
 await expect(page.locator('.stage-canvas.is-ready')).toBeVisible();
 await page.getByRole('radio',{name:'Your view',exact:true}).click();await expect(page.getByRole('radio',{name:'Your view',exact:true})).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await page.getByRole('radio',{name:'0.5×',exact:true}).click();
 await page.getByRole('button',{name:'Reset camera'}).click();expect(errors).toEqual([]);
});
test('sample coach creates a real catalog plan and never claims it synced',async({page})=>{
 await page.goto('/#/dashboard?sample=1');await expect(page.getByText('Sample data.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Bath & bedtime',exact:true}).click();await expect(page.locator('.plan-signs li')).not.toHaveCount(0);
 await expect(page.locator('.queued')).toContainText('With an account');
 await page.locator('.plan-signs a').first().click();await expect(page.locator('.stage-canvas.is-ready')).toBeVisible();
});
test('mobile and tablet pages do not overflow',async({page})=>{
 for(const width of [360,390,768]){
  await page.setViewportSize({width,height:844});
  for(const route of ['/#/','/#/dictionary','/#/dictionary/hello','/#/dashboard?sample=1','/#/pair','/#/privacy']){
   await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${route}`).toBe(true);
  }
 }
});
test('offline reload retains the dictionary after the first complete load',async({page,context})=>{
 await page.goto('/#/dictionary/hello');await expect(page.locator('.stage-canvas.is-ready')).toBeVisible();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.reload();await expect(page.locator('.stage-canvas.is-ready')).toBeVisible();await context.setOffline(false);
});
test('demo uses an active immersive session without touching real progress',async({page})=>{
 await page.goto('/');
 const saved=JSON.stringify({version:1,cards:{},settings:{displayName:'Preserve this learner'},createdAt:1,updatedAt:1});
 await page.evaluate(v=>localStorage.setItem('signsprout.progress.v1',v),saved);
 await page.goto('/app/?emulate&demo&fresh&autoxr&fov=72&pitch=-14&yaw=-12');
 await page.waitForFunction(()=>!!(window as any).__world?.session && !!(window as any).__app,{timeout:60000});
 await page.waitForFunction(()=>(window as any).__app.screen==='summary',{timeout:85000});
 expect(await page.evaluate(()=>localStorage.getItem('signsprout.progress.v1'))).toBe(saved);
 await page.screenshot({path:'out/e2e-summary.png'});
});
