import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:120000,expect:{timeout:20000},workers:1,
 use:{baseURL:process.env.TEST_URL||'http://localhost:8093',headless:true,viewport:{width:1440,height:900},launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']},screenshot:'only-on-failure',trace:'retain-on-failure'},
 reporter:[['list'],['html',{open:'never'}]],
});
