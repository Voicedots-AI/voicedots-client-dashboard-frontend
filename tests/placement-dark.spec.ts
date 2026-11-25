import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const folder=new URL('../src/pages/dashboard/',import.meta.url);
const css=(name:string)=>readFileSync(new URL(name,folder),'utf8').replace(/@import\s+[^;]+;/g,'');
test('dark roster, footer, search and secondary controls retain readable dark surfaces',async({page})=>{
 await page.setContent(`<html class="dark"><body><section class="placement-intelligence placement-dashboard-clean"><article class="pi-card pdo-recent"><a class="pdo-interview"><strong>Candidate name</strong><span class="pdo-score developing">25</span></a></article><article class="pi-card"><button>View skill gaps</button></article><div class="pi-deliverables"><article><h3>Interview foundation</h3></article></div><article class="pi-card pdo-development"><h2>Career progress</h2><a class="pi-link pi-clean-primary">Open Candidate 360°</a><button>Explore integrations</button></article></section><section class="feedback-dashboard placement-scheme"><label class="feedback-search"><input placeholder="Search feedback"/></label></section></body></html>`);
 // Load dark rules first: later light styles must not override the fixes.
 await page.addStyleTag({content:css('placement-dark.css')+css('placement-dashboard-clean.css')+css('placement-dashboard-theme.css')+css('placement-intelligence-extension.css')});
 for(const selector of ['.pdo-interview','.pi-deliverables article','.pdo-development','.feedback-search','.pi-card>button']){
  const element=page.locator(selector).first();await expect(element).toBeVisible();
  const value=await element.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
  expect(value.background,selector).not.toBe('rgb(255, 255, 255)');expect(value.color,selector).not.toBe(value.background);
 }
 await expect(page.locator('.pi-clean-primary')).toHaveCSS('background-color','rgb(36, 99, 235)');
 await expect(page.locator('.pi-clean-primary')).toHaveCSS('color','rgb(255, 255, 255)');
 await expect(page.locator('.pdo-score')).toHaveCSS('color','rgb(252, 211, 77)');
 await expect(page.locator('.feedback-search')).toHaveCSS('background-color','rgb(16, 28, 48)');
});
