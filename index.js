/*
Build a scraper based in NodeJS, that is using Pupeteer headless chrome to go into instagram.com

1. Use AWS SDK to consume messages from SQS (it doesnt have to really work, but write it so it potentially does work)
2. In the message, you will be given with instagram url, timestamp of last known post the system already has/
3. Go to that profile page, take all the posts until you reach to the post that has the timestamp that was given in the message.
4. For each post, get its title, image, and timestamp
5. After finishing, send this metadata to S3 as a .json file. (Again, doesnt have to really work)

Example for SQS message:
{ 'profile': 'daquan', timestamp: 1568828163 }
*/

// 1. get data from sqs
// 2. scrape
// 3. send to s3


const aws = require('./aws_module');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

scrape();

async function scrape() {
    console.log('started');
    // getting the profiles data from sqs
    let profiles = await aws.getProfiles().catch(err => {console.log("Received Error: ", err); return []});
    // aws call obviously fails so this is a hack to scrape some profiles
    if (profiles.length === 0 ) {
       profiles = [
           { 'profile': 'daquan', timestamp: 1569802400012 },
           { 'profile': 'therock', timestamp: 1569802400012 },
           { 'profile': 'adidas', timestamp: 1569802400012 },
       ]
    }
    console.log('profiles to scrape: ', profiles);
    // Here I used 2 different methods to solve the problem ->
    // in case we expect to scrape only the last 12 posts we should use "getLast12PostsData" ->
    // I discovered that Instagram has an object that contains all the data that we need -> So I just grab it
    profiles.forEach(profile => getLast12PostsData(profile.profile, profile.timestamp));
    //
    // in case that we expect to scrape more than 12 we should use "getPostsData"
    profiles.forEach(profile => getPostsData(profile.profile, profile.timestamp));
    console.log('finished');
}

async function getLast12PostsData(profileToScrape, lastScraped) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${profileToScrape}/`);
    const handle = await page.evaluateHandle(() => window);
    // get the data
    const posts = await page.evaluate(windowObj => windowObj._sharedData.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges, handle);
    await handle.dispose();
    let data = posts.map(post => ({
        // id: post.node.id,
        pic_url: post.node.display_url,
        timestamp: post.node.taken_at_timestamp,
        title: post.node.edge_media_to_caption.edges[0].node.text,
        post_url: `https://www.instagram.com/p/${post.node.shortcode}/`,
    }));
    const dataToUpload = data.filter(post => post.timestamp > lastScraped);
    await browser.close();

    fs.writeFile(`./savedProfiles/${profileToScrape}.json`, JSON.stringify(dataToUpload), err => {
        if (err) {console.log(err)}
        else {
            console.log(`wrote ${profileToScrape} data to file`);
            const base64data = new Buffer(JSON.stringify(dataToUpload), 'binary');
            aws.upload(profileToScrape, profileToScrape+Date.now(),base64data);
        }
    })
}

async function getPostsData(profileToScrape, lastScraped) {
    let posts = [];
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(`https://www.instagram.com/${profileToScrape}/`);
    // I assumed that the max number of posts will be a round 24 (older than that are not relevant)
    // we can load older posts by changing the  scroll below
    const scroll = 500;
    await page.mouse.move(0, scroll);
    const aLinks = await page.$$eval('body main article a', a => Array.from(a).map(a=> a.href));

    for (const post of aLinks) {
        await page.goto(post);
        const postTitle = await page.$eval('title', title => title.innerText);
        const postImg = await page.$eval('body main article>div img', img => img.src);
        const postTime = await page.$eval('body main article a time', time => time.dateTime);
        const time = new Date(postTime);
        const postTimestamp = time.getTime();
        if (postTimestamp > lastScraped ) {
            posts.push({
                // id :'id',
                pic_url: postImg,
                timestamp: time.getTime(),
                title: postTitle,
                post_url: post,
            });
        }
    }
    await browser.close();

    fs.writeFile(`./savedProfiles/${profileToScrape}.json`, JSON.stringify(posts), err => {
        if (err) {console.log(err)}
        else {
            console.log(`wrote ${profileToScrape} data to file`);
            const base64data = new Buffer(JSON.stringify(posts), 'binary');
            aws.upload(profileToScrape, profileToScrape+Date.now(),base64data);
        }
    })
}






// (async () => {

    // const handle = await page.evaluateHandle(() => ({window, document}));

    // const win = await page.evaluate(windowObj => windowObj._sharedData, handle);

    // console.log(win.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges);
    // const properties = await handle.getProperties();
    // console.log(properties)
    // const windowHandle = properties.get('window');
    // console.log(windowHandle)
    // const documentHandle = properties.get('document');
    // console.log(documentHandle)



    // const windowHandle = await page.evaluateHandle(() => window);
    // console.log(windowHandle.jsonValue());

    // const aHandle = await page.evaluateHandle('document');
    // console.log(aHandle);
    // await page.screenshot({path: 'example.png'});

    // console.log('dest');
// })();


// const https = require('https');
// function getData() {
//     console.log('get');
//     https.get('https://www.instagram.com/daquan/', res => {
//         let data = '';
//         res.on('data', chunk => data += chunk );
//         res.on('end', ()=> console.log(data))
//     })
// }

// scrape();
// getData();