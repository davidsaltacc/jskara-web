
async function loadMonaco() {
    require.config({ paths: { "vs": "https://unpkg.com/monaco-editor@latest/min/vs" } });
    
    await new Promise((res, rej) => {
        try {
            require(["vs/editor/editor.main"], res);
        } catch (e) {
            rej(e);
        }
    });
}

var gridSizeX = 9;
var gridSizeY = 9;
var gridZoom = 1;
var speed = 1;
var visibility = "visible";

var gridContainerElement = document.getElementById("world-grid");

var editor;
var worldWorker;

var running = false;
var lastWorldState = null;

function dragOver(evt) {
    evt.preventDefault();
}

function postWorkerMessage(...args) {
    if (running) {
        return; // TODO maybe error
    }
    worldWorker.postMessage(...args);
}

function initWorld(worldState) {

    worldWorker = new Worker("world.js");

    if (worldState) {
        worldWorker.postMessage({ action: "initWithWorld", world: worldState });
    } else {
        worldWorker.postMessage({ action: "init", sizeX: gridSizeX, sizeY: gridSizeY });
    }

    worldWorker.onmessage = evt => {
        if (evt.data.action == "repaint") {
            repaint(evt.data.repaintObjects);
        }
        if (evt.data.action == "stop") {
            running = false;
        }
        if (evt.data.action == "worldState") {
            lastWorldState = evt.data.world;
        }
    };

}

async function init() {

    if (!window.Worker) {
        throw new Error("Kann JSKara nicht in diesem Browser initialisieren");
    }

    initWorld();

    setZoom(gridZoom);

    await loadMonaco();
    
    editor = monaco.editor.create(document.getElementById("editor"), {
        theme: "vs-dark",
        value: "import jskara.JSKaraProgram;\n\n/* BEFEHLE:  kara.\n *   move()  turnRight()  turnLeft()\n *   putLeaf()  removeLeaf()\n *\n * SENSOREN: kara.\n *   treeFront()  treeLeft()  treeRight()\n *   mushroomFront()  onLeaf()\n */\npublic class FindeBaum extends JSKaraProgram {\n\n    // Hier kannst du eigene Methoden definieren\n\n    public void myProgram() {\n        // Hier kommt das Hauptprogramm hin, zB:\n        while (!kara.treeFront()) {\n            kara.move();\n        }\n    }\n}\n\n",
        language: "java",
        automaticLayout: true,
        minimap: { enabled: false }
    });

}

function setGridSize(width, height) {

    gridSizeX = width;
    gridSizeY = height;

    var gridContainer = gridContainerElement;
    gridContainer.innerHTML = "";
    gridContainer.style.gridTemplateColumns = "auto ".repeat(width);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {

            var item = document.createElement("div");

            item.className = "grid-item";
            item.id = "grid-" + x + "-" + y;

            item.ondragover = dragOver;

            item.ondrop = evt => {

                var data = JSON.parse(evt.dataTransfer.getData("text/plain"));

                if (data.type == "new") {
                    postWorkerMessage({ action: "addObject", object: data.data.object, x: x, y: y });
                } else if (data.type == "move") {
                    postWorkerMessage({ action: "moveObject", fromX: data.data.fromX, fromY: data.data.fromY, toX: x, toY: y, repaint: true });
                }

            };

            gridContainer.appendChild(item);

        }
    }

    postWorkerMessage({ action: "setSize", sizeX: width, sizeY: height });

}

function setGridSizeX(value) { setGridSize(value, gridSizeY); }
function setGridSizeY(value) { setGridSize(gridSizeX, value); }

function deleteObject(evt) {
    var data = JSON.parse(evt.dataTransfer.getData("text/plain"));
    if (data.type == "move") {
        postWorkerMessage({ action: "removeObject", x: data.data.fromX, y: data.data.fromY });
    }
}

function setZoom(zoom) {

    gridZoom = Math.max(Math.min(zoom, 5), 0.6);
    
    setGridSize(gridSizeX, gridSizeY);
    
    var gridItems = document.getElementsByClassName("grid-item");
    
    for (var item of gridItems) {
        item.style.width = item.style.height = Math.floor(zoom * 50) + "px";
    }

}

function increaseZoom() { setZoom(gridZoom + 0.2); }
function decreaseZoom() { setZoom(gridZoom - 0.2); }

function updateGrid() {
    setZoom(gridZoom);
}

document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
    }
});

// I did not write this regex madness, thanks CGPT
function javaToJsClass(javaCode) {
    
    var code = javaCode
        .replace(/import\s+[^\n]+;/g, '')
        .trim();

    const classMatch = code.match(/public\s+class\s+(\w+)\s*(extends\s+\w+)?/);
    if (!classMatch) {
        throw new Error("Keine gültige Java-Klasse gefunden!");
    }
    const className = classMatch[1];
    const extendsClause = classMatch[2] ? ` ${classMatch[2]}` : '';

    code = code.replace(/public\s+class\s+\w+\s*(extends\s+\w+)?\s*{/, `class ${className}${extendsClause} {`);

    code = code.replace(
        /(public|private|protected)?\s+void\s+(\w+)\s*\(([^)]*)\)/g,
        (_, __, methodName, args) => {
            const cleanArgs = args.replace(/\b(int|double|float|long|String|boolean|char|Point)\b\s+(\w+)/g, `$2`);
            return `${methodName}(${cleanArgs})`;
        }
    );

    code = code.replace(/\b(int|double|float|long|String|boolean|char|Point)\b\s+(\w+)\s*=/g, `let $2 =`);

    return [ code, classMatch[1] ];

}

var tab = 0;

function switchTabs() {

    tab = (tab + 1) % 2;

    document.getElementById("tab-switch").innerHTML = tab ? "Welt" : "Programmieren";
    document.getElementById("left").style.display = tab ? "block" : "none"; 
    document.getElementById("right").style.display = tab ? "none" : "block"; 
    document.getElementById("tab-switch-bar").style.justifyContent = tab ? "right" : "center"; 
    document.getElementById("tab-switch").style.marginRight = tab ? "18px" : "5px";

}

function startDrag(evt, type, data) {
    evt.dataTransfer.setData("text/plain", JSON.stringify({ type: type, data: data }));
}

function karaMove() { postWorkerMessage({ action: "karaMove", delay: false }); }
function karaTurnLeft() { postWorkerMessage({ action: "karaTurnLeft", delay: false }); }
function karaTurnRight() { postWorkerMessage({ action: "karaTurnRight", delay: false }); }
function karaPutLeaf() { postWorkerMessage({ action: "karaPutLeaf", delay: false }); }
function karaRemoveLeaf() { postWorkerMessage({ action: "karaRemoveLeaf", delay: false }); }

function repaint(objects) {

    for (var x = 0; x < gridSizeX; x++) {
        for (var y = 0; y < gridSizeY; y++) {

            var gridItems = document.getElementsByClassName("grid-item");
            for (var item of gridItems) {
                item.innerHTML = "";
            }

        }
    }

    objects.forEach(obj => { 

        var gridElement = document.getElementById("grid-" + obj.x + "-" + obj.y);
        var object = document.createElement("div");
        object.className = "world-object";
        object.draggable = true;
        
        object.ondragstart = evt => startDrag(evt, "move", { fromX: obj.x, fromY: obj.y });

        object.className += " " + obj.type + " orientation-" + obj.orientation + (obj.invisible ? " object-invisible" : "");

        gridElement.appendChild(object);

    });

}


function runProgram() {
    var jcode = editor.getValue();
    var [ code, className ] = javaToJsClass(jcode);
    postWorkerMessage({ action: "run", code: code, className: className }); 
    running = true;
}

function stopProgram() {
    worldWorker.terminate();
    running = false;
    initWorld(lastWorldState);
    changeSpeed(speed);
    setVisibility(visibility);
    postWorkerMessage({ action: "repaint" }); 
}

function changeSpeed(value) {
    speed = value;
    if (running) {
        // error
        return;
    }
    postWorkerMessage({ action: "setSpeed", speed: value }); 
}

function setVisibility(value) {
    visibility = value;
    if (running) {
        // error
        return;
    }
    postWorkerMessage({ action: "setVisibility", visibility: value }); 
}

function toggleGridSizeMenu() {
    var overlay = document.getElementById("gridsize-overlay");
    if (overlay.style.display == "none") {
        overlay.style.display = "flex";
    } else {
        overlay.style.display = "none";
    }
}

document.getElementById("gridsize-overlay").onclick = evt => {
    if (evt.target == document.getElementById("gridsize-overlay")) {
        toggleGridSizeMenu();
    }
};

await init();

const exports = {
    setGridSize,
    setZoom,
    updateGrid,
    increaseZoom,
    decreaseZoom,
    switchTabs,
    startDrag,
    dragOver,
    karaMove,
    karaTurnLeft,
    karaTurnRight,
    karaPutLeaf,
    karaRemoveLeaf,
    runProgram,
    stopProgram,
    changeSpeed,
    deleteObject,
    setVisibility,
    toggleGridSizeMenu,
    setGridSizeX,
    setGridSizeY
};
for (var [fname, func] of Object.entries(exports)) { window[fname] = func; }