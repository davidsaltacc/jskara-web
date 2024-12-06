class WorldObject {

    constructor() {
        this.x = null;
        this.y = null;
        this.world = null;
    }

    setPosition(x, y) {
        this.world.moveObject(this, x, y);
    }

    getPosition() {
        return new Point(this.x, this.y);
    }

    setWorld(world) {
        this.world = world;
    }

}

class World {

    constructor(a, b) {

        if (a.objects) { // world

            this.sizeX = a.sizeX;
            this.sizeY = a.sizeY;
            this.objects = [];

            a.objects.forEach(obj => {
                this.objects.push((() => { switch (obj.type) {
                    case "kara": return new JSKara();
                    case "tree": return new TreeStump();
                    case "mushroom": return new Mushroom();
                    case "clover": return new Clover();
                } })());
                var added = this.objects[this.objects.length - 1];
                added.setWorld(this);
                added.x = obj.x;
                added.y = obj.y;
                if (obj.type == "kara") { added.orientation = obj.orientation }
            });

            return;
        }

        this.sizeX = a;
        this.sizeY = b;
        this.objects = [];
    }

    getKara() {
        return this.objects.find(obj => obj instanceof JSKara);
    }

    setSize(x, y) {

        this.sizeX = x;
        this.sizeY = y;

        this.objects = this.objects.filter(obj => obj.x < this.sizeX && obj.y < this.sizeY);

        this.repaint();
        sendWorldState();

    }

    addObject(object, x, y) {

        if (this.getKara() && object instanceof JSKara) {
            this.getKara().setPosition(x, y);
            this.repaint();
            return;
        }

        var objsThere = this.getObjects(x, y);
        if (objsThere.length == 1) {
            if (objsThere[0] instanceof Clover && object instanceof Clover) {
                return;
            }
            if (!(objsThere[0] instanceof Clover) && !(object instanceof Clover)) {
                return;
            }
        }
        if (objsThere.length > 1) {
            return;
        }

        this.objects.push(object);
        object.setWorld(this);
        object.setPosition(x, y);

        this.repaint();
        sendWorldState();
        
    }

    moveObject(object, x, y) {
        
        var nx = ((x % this.sizeX) + this.sizeX) % this.sizeX; 
        var ny = ((y % this.sizeY) + this.sizeY) % this.sizeY;

        var objsThere = this.getObjects(nx, ny);

        if (objsThere.length == 1) {
            if (objsThere[0] instanceof Clover && object instanceof Clover) {
                throw new Error("Kann nicht " + object + " nach " + nx + ", " + ny + " bewegen.");
            }
            if (!(objsThere[0] instanceof Clover) && !(object instanceof Clover)) {
                throw new Error("Kann nicht " + object + " nach " + nx + ", " + ny + " bewegen.");
            }
        }
        if (objsThere.length == 2) {
            throw new Error("Kann nicht " + object + " nach " + nx + ", " + ny + " bewegen.");
        }

        object.x = nx; 
        object.y = ny;

        sendWorldState();

    }

    removeObject(object) {

        var index = this.objects.indexOf(object);
        this.objects.splice(index, 1);

        this.repaint();

        sendWorldState();

    }

    getObjects(x, y) {
        var nx = ((x % this.sizeX) + this.sizeX) % this.sizeX; 
        var ny = ((y % this.sizeY) + this.sizeY) % this.sizeY;
        return this.objects.filter(obj => obj.x == nx && obj.y == ny);
    }

    isVisible(object) {

        if (visibility == "all") {
            return true;
        }

        if (object instanceof JSKara) {
            return true;
        }

        var kara = this.getKara();

        if (!kara) {
            return false;
        }

        if (object instanceof Clover) {
            return kara.x == object.x && kara.y == object.y;
        }

        if (object instanceof Mushroom) {
            var positionFront = kara._positionInfront();
            return positionFront[0] == object.x && positionFront[1] == object.y;
        }

        if (object instanceof TreeStump) {
            var positionFront = kara._positionInfront();
            var offsetLeft = kara._orientationOffset((kara.orientation - 1 + 4) % 4);
            var offsetRight = kara._orientationOffset((kara.orientation + 1) % 4);
            return (
                (positionFront[0] == object.x && positionFront[1] == object.y) ||
                (kara.x + offsetLeft[0] == object.x && kara.y + offsetLeft[1] == object.y) ||
                (kara.x + offsetRight[0] == object.x && kara.y + offsetRight[1] == object.y)
            );
        }

        return false;

    }

    repaint() {

        var objs = [];

        this.objects.forEach(obj => {
            objs.push({
                x: obj.x,
                y: obj.y,
                orientation: obj.orientation ?? 0,
                type: (() => { switch (obj.constructor) {
                    case JSKara: return "kara";
                    case TreeStump: return "tree";
                    case Mushroom: return "mushroom";
                    case Clover: return "clover";
                } })(),
                invisible: !this.isVisible(obj)
            });
        });

        postMessage({ action: "repaint", repaintObjects: objs });

    }

}

class Point { // java.awt.Point just in case

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    distanceSq(x, y) {
        return x instanceof Point ? (Math.pow(x.x - this.x, 2) + Math.pow(x.y - this.y, 2)) : (Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2));
    }
    
    distance(x, y) {
        return Math.sqrt(this.distanceSq(x, y));
    }

}

function sleep(duration){
    var now = new Date().getTime();
    while (new Date().getTime() < now + duration){ /* do nothing, sorry web worker */ }
}

function sendWorldState() {
    var objs = [];
    world.objects.forEach(obj => {
        objs.push({
            x: obj.x,
            y: obj.y,
            orientation: obj.orientation ?? 0,
            type: (() => { switch (obj.constructor) {
                case JSKara: return "kara";
                case TreeStump: return "tree";
                case Mushroom: return "mushroom";
                case Clover: return "clover";
            } })()
        });
    });
    postMessage({ action: "worldState", world: {
        sizeX: world.sizeX,
        sizeY: world.sizeY,
        objects: objs
    } });
}

class TreeStump extends WorldObject {}
class Mushroom extends WorldObject {}
class Clover extends WorldObject {}
class JSKara extends WorldObject {

    constructor() {
        super();
        this.orientation = 1;
    }

    move(noDelay) {

        var [ fx, fy ] = this._positionInfront();
        var infront = this.world.getObjects(fx, fy);

        if (infront.length == 0 || (infront[0] instanceof Clover && infront.length == 1)) {
            this.setPosition(fx, fy);
        }
        if (infront.length == 2) {
            infront.splice(infront.findIndex(o => o instanceof Clover), 1);
        }
        if (infront.length == 1 && infront[0] instanceof TreeStump) {
            return; // TODO error (aswell as in other non-possible cases when smth in jskara is called)
        }
        if (infront.length == 1 && infront[0] instanceof Mushroom) {
            var offset = this._lookDirOffset();
            try {
                infront[0].setPosition(fx + offset[0], fy + offset[1]); 
                this.setPosition(fx, fy);
            } catch {
                return; // error here
            }
        }

        this.world.repaint();
 
        if (!noDelay) {
            sleep(1000 * speed);
        }

    }

    turnLeft(noDelay) {
        this.orientation = (this.orientation - 1 + 4) % 4;
        this.world.repaint();
        if (!noDelay) {
            sleep(1000 * speed);
        }
    }

    turnRight(noDelay) {
        this.orientation = (this.orientation + 1) % 4;
        this.world.repaint();
        if (!noDelay) {
            sleep(1000 * speed);
        }
    }

    putLeaf(noDelay) {
        if (this.onLeaf()) {
            return; // throw
        } 
        this.world.addObject(new Clover(), this.x, this.y);
        if (!noDelay) {
            sleep(1000 * speed);
        }
    }
    
    removeLeaf(noDelay) {
        if (!this.onLeaf()) {
            return; // throw
        } 
        this.world.removeObject(this.world.getObjects(this.x, this.y).find(o => o instanceof Clover));
        if (!noDelay) {
            sleep(1000 * speed);
        }
    }

    onLeaf() {
        return (this.world.getObjects(this.x, this.y).length == 2);
    }
    
    mushroomFront() {
        var posInfront = this._positionInfront();
        return Boolean(this.world.getObjects(posInfront[0], posInfront[1]).find(o => o instanceof Mushroom));
    }

    treeFront() {
        var posInfront = this._positionInfront();
        return Boolean(this.world.getObjects(posInfront[0], posInfront[1]).find(o => o instanceof TreeStump));
    }

    treeLeft() {
        var offset = this._orientationOffset((this.orientation - 1 + 4) % 4);
        return Boolean(this.world.getObjects(this.x + offset[0], this.y + offset[1]).find(o => o instanceof TreeStump));
    }

    treeRight() {
        var offset = this._orientationOffset((this.orientation + 1) % 4);
        return Boolean(this.world.getObjects(this.x + offset[0], this.y + offset[1]).find(o => o instanceof TreeStump));
    }

    _orientationOffset(orientation) {
        var x = 0;
        var y = 0;
        if (orientation == 0) { y = y - 1; }
        if (orientation == 1) { x = x + 1; }
        if (orientation == 2) { y = y + 1; }
        if (orientation == 3) { x = x - 1; }
        return [ x, y ];
    }

    _lookDirOffset() {
        return this._orientationOffset(this.orientation);
    }

    _positionInfront() {
        var [ ox, oy ] = this._lookDirOffset();
        var nx = this.x + ox;
        var ny = this.y + oy;
        return [ ((nx % this.world.sizeX) + this.world.sizeX) % this.world.sizeX, ((ny % this.world.sizeY) + this.world.sizeY) % this.world.sizeY ];
    }

    _getObjectsInfront() {
        var [ x, y ] = this._positionInfront();
        return this.world.getObjects(x, y);
    }
}

class JSKaraProgram {};

var world;

var speed = 1;
var visibility = "visible";

onmessage = evt => {

    if (evt.data.action == "init") {
        world = new World(evt.data.sizeX, evt.data.sizeY);
    }
    
    if (evt.data.action == "initWithWorld") {
        world = new World(evt.data.world);
    }

    if (evt.data.action == "setSize") {
        world.setSize(evt.data.sizeX, evt.data.sizeY);
    }

    if (evt.data.action == "addObject") {
        world.addObject((() => { switch (evt.data.object) {
            case "kara": return new JSKara();
            case "tree": return new TreeStump();
            case "mushroom": return new Mushroom();
            case "clover": return new Clover();
        } })(), evt.data.x, evt.data.y);
    }

    if (evt.data.action == "moveObject") {
        var objsThere = world.getObjects(evt.data.fromX, evt.data.fromY);
        world.moveObject(objsThere.length == 1 ? objsThere[0] : objsThere.find(o => !(o instanceof Clover)), evt.data.toX, evt.data.toY);
        if (evt.data.repaint) {
            world.repaint();
        }
    }

    if (evt.data.action == "removeObject") {
        var objsThere = world.getObjects(evt.data.x, evt.data.y);
        world.removeObject(objsThere.length == 1 ? objsThere[0] : objsThere.find(o => !(o instanceof Clover)));
    }

    if (evt.data.action == "karaMove") { world.getKara().move(!evt.data.delay); }
    if (evt.data.action == "karaTurnLeft") { world.getKara().turnLeft(!evt.data.delay); }
    if (evt.data.action == "karaTurnRight") { world.getKara().turnRight(!evt.data.delay); }
    if (evt.data.action == "karaPutLeaf") { world.getKara().putLeaf(!evt.data.delay); }
    if (evt.data.action == "karaRemoveLeaf") { world.getKara().removeLeaf(!evt.data.delay); }
    
    if (evt.data.action == "repaint") {
        world.repaint();
    }

    if (evt.data.action == "run") {
        eval(`
if (!world.getKara()) {
    throw new Error("Kein kara in der welt!");
}
let kara = world.getKara();

${evt.data.code}

let programClass = (new ${evt.data.className}());
programClass.myProgram();

postMessage({ action: "stop" });
        `);
    }
    
    if (evt.data.action == "setSpeed") {
        speed = evt.data.speed;
    }
    
    if (evt.data.action == "setVisibility") {
        visibility = evt.data.visibility;
        world.repaint();
    }
    
}