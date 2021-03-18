const { Cluster } = require('puppeteer-cluster');
var mongoDB = require('./server.js');

(async () => {

  let browserArgs = [
    '--enable-features=NetworkService',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--shm-size=4gb'
  ];

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 2,
    puppeteerOptions: {
      headless: false,
      args: browserArgs
    }
  });

  await cluster.task(async ({ page, data: url }) => {
    await page.goto(url);
    const startStateDispElems = await page.evaluate(() => {
      var all = document.getElementsByTagName("*");
      var dispElems = [];

      for (var i = 0, max = all.length; i < max; i++) {
        if (!isHidden(all[i])) {
          dispElems[i] = {
            xpath: getXPathForElement(all[i]),
            text: all[i].textContent,
            value: all[i].value || "NULL",
            bottom: all[i].getBoundingClientRect().bottom,
            height: all[i].getBoundingClientRect().height,
            left: all[i].getBoundingClientRect().left,
            right: all[i].getBoundingClientRect().right,
            top: all[i].getBoundingClientRect().top,
            width: all[i].getBoundingClientRect().width,
            x: all[i].getBoundingClientRect().x,
            y: all[i].getBoundingClientRect().y,
            padding: window.getComputedStyle(all[i]).getPropertyValue('padding'),
            color: window.getComputedStyle(all[i]).getPropertyValue('color'),
            backColor: window.getComputedStyle(all[i]).getPropertyValue('back-color'),
            borderWidth: window.getComputedStyle(all[i]).getPropertyValue('border-width'),
            borderColor: window.getComputedStyle(all[i]).getPropertyValue('border-color'),
            font: window.getComputedStyle(all[i]).getPropertyValue('font'),
            zIndex: window.getComputedStyle(all[i]).getPropertyValue('z-index')
          };
        }
      }

      function isHidden(el) {
        var style = window.getComputedStyle(el);
        return ((style.display === 'none') || (style.visibility === 'hidden'))
      }

      function getXPathForElement(element) { // get xpath of the element
        const idx = (sib, name) => sib
          ? idx(sib.previousElementSibling, name || sib.localName) + (sib.localName == name)
          : 1;
        const segs = elm => !elm || elm.nodeType !== 1
          ? ['']
          : elm.id && document.getElementById(elm.id) === elm
            ? [`id("${elm.id}")`]
            : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
        return segs(element).join('/');
      }
      dispElems = dispElems.filter(n => n)
      return dispElems
    });
    const startStateElems = startStateDispElems;
    function deepEqual(object1, object2) {
      const keys1 = Object.keys(object1);
      const keys2 = Object.keys(object2);

      if (keys1.length !== keys2.length) {
        return false;
      }

      for (const key of keys1) {
        const val1 = object1[key];
        const val2 = object2[key];
        const areObjects = isObject(val1) && isObject(val2);
        if (
          areObjects && !deepEqual(val1, val2) ||
          !areObjects && val1 !== val2
        ) {
          return false;
        }
      }

      return true;
    }

    function isObject(object) {
      return object != null && typeof object === 'object';
    }

    let scenarioCtr = 1;
    let outputElems = [];
    let inputElems = [];
    let unClickableElems = [];
    let endElems = [];

    var combiSet = [];
    var x = startStateDispElems.length;//check length of displayed start state Elems
    var point = 1;

    for (var i = 0; i < x; i++) { // the algo
      for (var k = point; k <= x; k++) {
        combiSet.push(k);
      }
      for (var j = 1; j < point; j++) {
        combiSet.push(j);
      }
      point++;
    }

    const noOfThreads = 2;
    var combiSetChunk = chunkArray(combiSet, noOfThreads);

    console.log(combiSetChunk);

    // for (var i = 1; i <= noOfThreads; i++) { // uncomment to insert IDs
    //   mongoDB.patchData("algoCluster", { _id: i, state: "hold", data: combiSetChunk[i-1] });
    //   await page.waitFor(500);
    // }

    function chunkArray(arr, chunkCount) {
      const chunks = [];
      while (arr.length) {
        const chunkSize = Math.ceil(arr.length / chunkCount--);
        const chunk = arr.slice(0, chunkSize);
        chunks.push(chunk);
        arr = arr.slice(chunkSize);
      }
      return chunks;
    }

    const algoClustResult = await mongoDB.queryData("algoCluster", { state: "hold" });
    const algoClustData = algoClustResult[0].data;
    console.log("Using Cluster ID: " + algoClustResult[0]._id);
    // update state in db
    mongoDB.updateData("algoCluster", { _id: algoClustResult[0]._id }, { state: "inprogress" });
    await page.waitFor(2000);
    let stepCtr = 0;

    // ----------------------------------------------------------check Output Elements-------------------------
    // start scanning for output Elements
    for (var i = 0; i < algoClustData.length; i++) {
      await evaluateOutputElems(algoClustData[i] - 1);
      // console.log(algoClustData[i] - 1);
      // console.log(stepCtr + " : " + (algoClustData[i]));
      stepCtr++;
    }
    console.log("Total Step Performed:" + (stepCtr - 1));

    // output elements result
    outputElems = outputElems.filter(a => ((!a.includes(`html`)) && (!a.includes(`body`)))); // remove body and html

    for (var i = 0; i < outputElems.length; i++) { // remove shallow xpaths
      for (var x = i; x < outputElems.length; x++) {
        if (outputElems[x].includes(outputElems[i])) {
          outputElems = outputElems.filter(el => el !== outputElems[x - 1]);
        }
      }
    }
    console.log("bang");
    // console.log(outputElems);

    await mongoDB.patchData("resultElements", { _id: "outputElements", data: outputElems })
    await page.waitFor(1000);
    async function evaluateOutputElems(index) {
      const runStateDispElem = await page.evaluate(() => {
        var all = document.getElementsByTagName("*");
        var dispElems = [];

        for (var i = 0, max = all.length; i < max; i++) {
          if (!isHidden(all[i])) {
            dispElems[i] = {
              xpath: getXPathForElement(all[i]),
              text: all[i].textContent,
              value: all[i].value || "NULL",
              bottom: all[i].getBoundingClientRect().bottom,
              height: all[i].getBoundingClientRect().height,
              left: all[i].getBoundingClientRect().left,
              right: all[i].getBoundingClientRect().right,
              top: all[i].getBoundingClientRect().top,
              width: all[i].getBoundingClientRect().width,
              x: all[i].getBoundingClientRect().x,
              y: all[i].getBoundingClientRect().y,
              padding: window.getComputedStyle(all[i]).getPropertyValue('padding'),
              color: window.getComputedStyle(all[i]).getPropertyValue('color'),
              backColor: window.getComputedStyle(all[i]).getPropertyValue('back-color'),
              borderWidth: window.getComputedStyle(all[i]).getPropertyValue('border-width'),
              borderColor: window.getComputedStyle(all[i]).getPropertyValue('border-color'),
              font: window.getComputedStyle(all[i]).getPropertyValue('font'),
              zIndex: window.getComputedStyle(all[i]).getPropertyValue('z-index')
            };
          }
        }

        function isHidden(el) {
          var style = window.getComputedStyle(el);
          return ((style.display === 'none') || (style.visibility === 'hidden'))
        }

        function getXPathForElement(element) { // get xpath of the element
          const idx = (sib, name) => sib
            ? idx(sib.previousElementSibling, name || sib.localName) + (sib.localName == name)
            : 1;
          const segs = elm => !elm || elm.nodeType !== 1
            ? ['']
            : elm.id && document.getElementById(elm.id) === elm
              ? [`id("${elm.id}")`]
              : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
          return segs(element).join('/');
        }
        dispElems = dispElems.filter(n => n)
        return dispElems
      });

      try {
        // await page.screenshot({path: 'example' + i + '.png'});
        const elements = await page.$x(await startStateElems[index].xpath);
        // console.log(await startStateElems[index].xpath);
        await elements[0].click();
        // console.log(runStateDispElem);
      } catch (e) {
        // console.log(e);
        // await page.screenshot({path: algoClustResult[0]._id + 'error' + i + '.png'});
      }

      // check first outputElems
      if ((startStateElems[index].value) !== (await runStateDispElem[index].value)) {
        if (!outputElems.includes(await runStateDispElem[index].xpath)) {
          outputElems.push(await runStateDispElem[index].xpath);
        }
      }
      else {
        // unClickableElems.push(startStateElems[i]);
      }
    }
    // ----------------------------------------------------------check Output Elements-------------------------

    // ----------------------------------------------------------check Input Elements-------------------------

    // get Result Elements in db
    const getResultElements = await mongoDB.queryData("resultElements", { _id: "outputElements" });
    const getResultOutputElems = getResultElements[0].data;

    // start scanning for Input Elements
    for (var o = 0; o < getResultOutputElems.length; o++) {
      for (var i = 0; i < algoClustData.length; i++) {
        await evaluateInputElems(algoClustData[i] - 1, getResultOutputElems[o]);
      }
    }

    // Insert Input Elements in DB
    let tempInputElems = await mongoDB.queryData("resultElements", { _id: "inputElements" });
    console.log(tempInputElems.length);
    if (!tempInputElems.length) {
      await mongoDB.insertData("resultElements", { _id: "inputElements", data: inputElems.sort() })
    } else {
      tempInputElems = tempInputElems[0].data;
      const patchInputElems = tempInputElems.concat(inputElems.filter((item) => tempInputElems.indexOf(item) < 0))
      await mongoDB.patchData("resultElements", { _id: "inputElements", data: patchInputElems.sort() })
    }

    // Insert End Elements in DB
    let tempEndElems = await mongoDB.queryData("resultElements", { _id: "endElements" });
    if (!tempEndElems.length) {
      await mongoDB.insertData("resultElements", { _id: "endElements", data: endElems.sort() })
    } else {
      tempEndElems = tempEndElems[0].data;
      const patchEndElems = tempEndElems.concat(endElems.filter((item) => tempEndElems.indexOf(item) < 0))
      await mongoDB.patchData("resultElements", { _id: "endElements", data: patchEndElems.sort() })
    }

    // Insert UnClickable Elements in DB
    unClickableElems = unClickableElems.filter(a => ((!a.includes(`html`)) && (!a.includes(`body`)))); // remove body and html
    unClickableElems = unClickableElems.filter(val => !outputElems.includes(val)); // Filter from Output Elements
    unClickableElems = unClickableElems.filter(val => !inputElems.includes(val)); // FIlter from Input Elements
    unClickableElems = unClickableElems.filter(val => !endElems.includes(val)); // Filetr from End Elements
    unClickableElems = unClickableElems.sort();

    let tempUnclickableElems = await mongoDB.queryData("resultElements", { _id: "unclickableElements" });
    if (!tempUnclickableElems.length) {
      await mongoDB.insertData("resultElements", { _id: "unclickableElements", data: unClickableElems })
    } else {
      tempUnclickableElems = tempUnclickableElems[0].data
      tempUnclickableElems = tempUnclickableElems.sort();
      const patchUnclickableElems = unClickableElems.filter(val => tempUnclickableElems.includes(val));
      await mongoDB.patchData("resultElements", { _id: "unclickableElements", data: patchUnclickableElems })
    }

    // Function
    async function evaluateInputElems(index, outputElemXpath) {

      await page.waitForXPath(outputElemXpath)

      const startTempOutputElement = await page.evaluate((outputElemXpath) => {
        var myXpath = outputElemXpath

        function getElementsByXPath(xpath, parent) {
          let results = [];
          let query = document.evaluate(xpath, parent || document,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0, length = query.snapshotLength; i < length; ++i) {
            results.push(query.snapshotItem(i));
          }
          return results;
        }

        var [resultXpath] = getElementsByXPath(myXpath);

        var stateElem = {
          xpath: myXpath,
          text: resultXpath.textContent,
          value: resultXpath.value,
          bottom: resultXpath.getBoundingClientRect().bottom,
          height: resultXpath.getBoundingClientRect().height,
          left: resultXpath.getBoundingClientRect().left,
          right: resultXpath.getBoundingClientRect().right,
          top: resultXpath.getBoundingClientRect().top,
          width: resultXpath.getBoundingClientRect().width,
          x: resultXpath.getBoundingClientRect().x,
          y: resultXpath.getBoundingClientRect().y,
          padding: window.getComputedStyle(resultXpath).getPropertyValue('padding'),
          color: window.getComputedStyle(resultXpath).getPropertyValue('color'),
          backColor: window.getComputedStyle(resultXpath).getPropertyValue('back-color'),
          borderWidth: window.getComputedStyle(resultXpath).getPropertyValue('border-width'),
          borderColor: window.getComputedStyle(resultXpath).getPropertyValue('border-color'),
          font: window.getComputedStyle(resultXpath).getPropertyValue('font'),
          zIndex: window.getComputedStyle(resultXpath).getPropertyValue('z-index')
        };

        return stateElem;
      }, outputElemXpath);

      try {
        // await page.screenshot({path: 'example' + i + '.png'});
        // await page.waitForXPath(outputElemXpath);
        // const elements = await page.$x(await startStateDispElems[index].xpath);
        // console.log(await startStateDispElems[index].xpath);
        // await elements[0].click({ delay: 30 });
        // console.log(runStateDispElem);
        await page.waitForXPath(startStateElems[index].xpath, { visible: true })
        const [inputElem] = await page.$x(startStateElems[index].xpath);
        if (inputElem) {
          await inputElem.click();
        }
      } catch (e) {
        // console.log(e);
        // await page.screenshot({path: algoClustResult[0]._id + 'error' + i + '.png'});
      }

      const runStateDispElem = await page.evaluate(() => {
        var all = document.getElementsByTagName("*");
        var dispElems = [];

        for (var i = 0, max = all.length; i < max; i++) {
          if (!isHidden(all[i])) {
            dispElems[i] = {
              xpath: getXPathForElement(all[i]),
              text: all[i].textContent,
              value: all[i].value || "NULL",
              bottom: all[i].getBoundingClientRect().bottom,
              height: all[i].getBoundingClientRect().height,
              left: all[i].getBoundingClientRect().left,
              right: all[i].getBoundingClientRect().right,
              top: all[i].getBoundingClientRect().top,
              width: all[i].getBoundingClientRect().width,
              x: all[i].getBoundingClientRect().x,
              y: all[i].getBoundingClientRect().y,
              padding: window.getComputedStyle(all[i]).getPropertyValue('padding'),
              color: window.getComputedStyle(all[i]).getPropertyValue('color'),
              backColor: window.getComputedStyle(all[i]).getPropertyValue('back-color'),
              borderWidth: window.getComputedStyle(all[i]).getPropertyValue('border-width'),
              borderColor: window.getComputedStyle(all[i]).getPropertyValue('border-color'),
              font: window.getComputedStyle(all[i]).getPropertyValue('font'),
              zIndex: window.getComputedStyle(all[i]).getPropertyValue('z-index')
            };
          }
        }

        function isHidden(el) {
          var style = window.getComputedStyle(el);
          return ((style.display === 'none') || (style.visibility === 'hidden'))
        }

        function getXPathForElement(element) { // get xpath of the element
          const idx = (sib, name) => sib
            ? idx(sib.previousElementSibling, name || sib.localName) + (sib.localName == name)
            : 1;
          const segs = elm => !elm || elm.nodeType !== 1
            ? ['']
            : elm.id && document.getElementById(elm.id) === elm
              ? [`id("${elm.id}")`]
              : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
          return segs(element).join('/');
        }
        dispElems = dispElems.filter(n => n)
        return dispElems
      });

      // check Changes after actions
      await page.waitForXPath(outputElemXpath)

      const actualTempOutputElement = await page.evaluate((outputElemXpath) => {
        var myXpath = outputElemXpath

        function getElementsByXPath(xpath, parent) {
          let results = [];
          let query = document.evaluate(xpath, parent || document,
            null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0, length = query.snapshotLength; i < length; ++i) {
            results.push(query.snapshotItem(i));
          }
          return results;
        }

        var [resultXpath] = getElementsByXPath(myXpath);

        var stateElem = {
          xpath: myXpath,
          text: resultXpath.textContent,
          value: resultXpath.value,
          bottom: resultXpath.getBoundingClientRect().bottom,
          height: resultXpath.getBoundingClientRect().height,
          left: resultXpath.getBoundingClientRect().left,
          right: resultXpath.getBoundingClientRect().right,
          top: resultXpath.getBoundingClientRect().top,
          width: resultXpath.getBoundingClientRect().width,
          x: resultXpath.getBoundingClientRect().x,
          y: resultXpath.getBoundingClientRect().y,
          padding: window.getComputedStyle(resultXpath).getPropertyValue('padding'),
          color: window.getComputedStyle(resultXpath).getPropertyValue('color'),
          backColor: window.getComputedStyle(resultXpath).getPropertyValue('back-color'),
          borderWidth: window.getComputedStyle(resultXpath).getPropertyValue('border-width'),
          borderColor: window.getComputedStyle(resultXpath).getPropertyValue('border-color'),
          font: window.getComputedStyle(resultXpath).getPropertyValue('font'),
          zIndex: window.getComputedStyle(resultXpath).getPropertyValue('z-index')
        };

        return stateElem;
      }, outputElemXpath);
      // console.log(startTempText + "===" + actualTempText)
      if (deepEqual(startTempOutputElement, actualTempOutputElement) === false) { // Find Input or Clickable Elements
        if (!inputElems.includes(startStateElems[index].xpath)) {
          inputElems.push(startStateElems[index].xpath);
        }
      } else { //Find UnClickable Elements
        if (!unClickableElems.includes(startStateElems[index].xpath)) {
          unClickableElems.push(startStateElems[index].xpath);
        }
      }

      if (deepEqual(startStateElems, runStateDispElem) === true) { // find End Elems
        if (!endElems.includes(startStateElems[index].xpath)) {
          endElems.push(startStateElems[index].xpath);
        }
      }
    }

    // ----------------------------------------------------------check Input Elements-------------------------

    // --------------------------------------------------start fresh state scenario gathering-----------------
    //first get Input Elements in Databasu
    const getResultInputElements = await mongoDB.queryData("resultElements", { _id: "inputElements" });
    const getResultInputElems = getResultInputElements[0].data;

    //get index of endElement from InputElements (as for now use 1 end element)
    let getIndexOfEndElemfromInputElements = 0;

    getIndexOfEndElemfromInputElements = getResultInputElems.indexOf(tempEndElems[0]);
    console.log("The Index of the end element is: " + getIndexOfEndElemfromInputElements);

    //generate scenario permutations then insert in databasu

    var getResultInputElemLength = getResultInputElems.length;
    var mergeArrayInputElem = [];

    for (var i = 0; i < getResultInputElemLength; i++) {
      mergeArrayInputElem.push("," + i);
    }

    function getCombinations(chars) {
      var result = [];
      var f = function (prefix, chars) {
        for (var i = 0; i < chars.length; i++) {
          result.push(prefix + chars[i]);
          f(prefix + chars[i], chars.slice(i + 1));
        }
      }
      f("" + getIndexOfEndElemfromInputElements, chars);
      return result;
    }

    var allres = getCombinations(mergeArrayInputElem);

    var resultCombiArr = [];
    for (var i = 0; i < allres.length; i++) {
      resultCombiArr[i] = allres[i].split(",");
    }

    // console.log(resultCombiArr);

    var combiScenarioSetChunk = chunkArray(resultCombiArr, noOfThreads);

    // console.log(combiScenarioSetChunk);

    // for (var i = 1; i <= noOfThreads; i++) { // uncomment to insert permutation of input elements
    //   await mongoDB.patchData("algoScenarioCluster", { _id: i, state: "hold", data: combiScenarioSetChunk[i - 1] });
    //   await page.waitFor(3000);
    // }

    const algoScenarioClustResult = await mongoDB.queryData("algoScenarioCluster", { state: "hold" });
    const algoScenarioData = algoScenarioClustResult[0].data;
    console.log("Using Cluster ID: " + algoScenarioClustResult[0]._id);
    // update state in db
    mongoDB.updateData("algoScenarioCluster", { _id: algoScenarioClustResult[0]._id }, { state: "inprogress" });
    await page.waitFor(2000);

    // performe permutation scenarios
    console.log(algoScenarioData[0]);

    await browser.close();
  });

  function delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time)
    });
  }

  // for Testing
  await mongoDB.updateData("algoCluster", { state: "inprogress" }, { state: "hold" })
  await mongoDB.updateData("algoCluster", { state: "inprogress" }, { state: "hold" })
  await delay(1000);
  await mongoDB.updateData("algoScenarioCluster", { state: "inprogress" }, { state: "hold" })
  await mongoDB.updateData("algoScenarioCluster", { state: "inprogress" }, { state: "hold" })
  await delay(1000);

  cluster.queue('http://localhost:8080/sample-calculator/');
  await delay(1000);
  cluster.queue('http://localhost:8080/sample-calculator/');
  // many more pages
  await cluster.idle();
  await cluster.close();
})();