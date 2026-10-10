import { expect,type Page,type BrowserContext } from '@playwright/test';
let cookies:Awaited<ReturnType<BrowserContext['cookies']>>=[];
export async function login(page:Page){
 if(cookies.length)await page.context().addCookies(cookies);
 await page.goto('/');const auth=await(await page.request.get('/api/auth')).json();
 if(!auth.authenticated){
  if(!auth.configured){await page.getByLabel('Choose a password').fill('browser-test-kitchen-password');await page.getByLabel('Confirm password').fill('browser-test-kitchen-password');await page.getByRole('button',{name:'Create my workspace'}).click();}
  else{await page.getByLabel('Password',{exact:true}).fill('browser-test-kitchen-password');await page.getByRole('button',{name:'Unlock kitchen'}).click();}
 }
 await expect(page.getByRole('heading',{name:'Your kitchen, at a glance.'})).toBeVisible();
 cookies=await page.context().cookies();
}
