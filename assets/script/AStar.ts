// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html



/**
 * A*算法总结
 * 1.从起点开始，遍历得到起点周围点，排除掉障碍物后，将剩余的点放入openList中，即待验证计算的点的合集 并将它们的父节点设为起点，同时计算每个点的路径估值
 *   F = G + H
 *   其中，G为从起点开始到目标点所需要的步数，H为目标点到终点所需要的步数（无视障碍物，作出直接的估算，即Manhattan算法），F即通过该点到终点所需要的距离
 * 2.将起点放入closeList中，closeList即为经过验证计算的点的合集，其中的点后续无需再重新验证计算。
 * 3.遍历openList，取出F值最小的点设为新的验证计算的点，并将其放入closeList中。
 * 4.查找新的验证计算的点周围的点，排除障碍物后
 *   4-1 若周围的点不存在于openList中，将它们加入openList中，并将当前验证计算的点设为这些点的父节点。
 *   4-2 若周围的点已经存在于openList中，判断此点的原先的G值，是否大于通过验证计算的点到达此点的G值。如果大于，则证明通过验证计算的点到此点所用的距离G，要比原本此点的G要少，则
 *       通过验证计算的点到达此点路径更短。则将此点的父节点设为当前验证计算的点，并更新G和F（因为更新了到达此点的路径）。
 *   4-3 如果不大于，则不做任何操作。
 * 5.从第三步重复做起，直到终点也加入到openList中，证明终点已经到了验证计算的点的周围了。
 * 6.从终点开始，拿到终点的父节点，即父节点就是终点的前一步，再取父节点的父节点，即父节点的前一步。直到没有父节点为止，此时所有的父节点就是计算得到的路径。
 * 7.若没有找到路径，且openList变为空了，证明验证了所有的节点也没找到终点，证明没有路径。
 */
const { ccclass, property } = cc._decorator;

class MapNodeInfo {
    x: Number = 0;
    y: Number = 0;
    G: Number = 0;//从起点移动到当前位置的距离
    H: Number = 0;//从当前位置移动到终点的距离
    F: Number = this.G + this.H;
    timeStamp: Number = 0;//时间戳，用来判断添加到信息库中的时间
    parentMapNode = null;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.timeStamp = new Date().getTime();
    }
}

@ccclass
export default class NewClass extends cc.Component {

    @property
    rectSize: Number = 20;

    startPoint: cc.Vec2 = cc.v2(15, 20);
    endPoint: cc.Vec2 = cc.v2(20, 20);
    mapRect: cc.Rect = new cc.Rect(0, 0, 0, 0);//地图区域
    minX: Number = 0;//地图分割出来的区域块边界
    maxX: Number = 0;
    minY: Number = 0;
    maxY: Number = 0;
    moveType: Number = 0;//0:什么都不做 1:移动起点 2:移动终点 3:添加障碍物 4:删除障碍物
    obstacles: Object = {};//障碍物合集
    graphicsBody: cc.Graphics = null;
    path: Array<MapNodeInfo> = [];//路径
    openList: Object = {};//一个可能会经过的路径的合集，每次都会检查这里面的节点是否可以使用
    closeList: Object = {};//无需再检查的路径合集


    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start() {
        this.graphicsBody = this.node.addComponent(cc.Graphics);
        this.init();
        this.paint();
    }

    //初始化地图，将地图划分为若干块
    init() {
        this.mapRect = new cc.Rect(cc.view.getVisibleOrigin().x, cc.view.getVisibleOrigin().y, cc.view.getVisibleSize().width, cc.view.getVisibleSize().height)
        this.minX = 0;
        this.maxX = Math.ceil(this.mapRect.width / this.rectSize);
        this.minY = 0;
        this.maxY = Math.ceil(this.mapRect.height / this.rectSize);
        cc.Canvas.instance.node.on(cc.Node.EventType.MOUSE_DOWN, this.touchDown, this);//监听事件，用来监听拖动起点、终点、绘制和清除障碍
    }

    touchDown(e) {
        let touchX = Math.floor(e.getLocationX() / this.rectSize);
        let touchY = Math.floor(e.getLocationY() / this.rectSize);

        if (this.startPoint.x === touchX && this.startPoint.y === touchY) {
            this.moveType = 1;
        } else if (this.endPoint.x === touchX && this.endPoint.y === touchY) {
            this.moveType = 2;
        } else if (!this.obstacles[`${touchX}-${touchY}`]) {
            this.moveType = 3;
        } else {
            this.moveType = 4;
        }

        cc.Canvas.instance.node.on(cc.Node.EventType.MOUSE_UP, this.touchUp, this);
        cc.Canvas.instance.node.on(cc.Node.EventType.MOUSE_MOVE, this.touchMove, this);
    }

    //抬起鼠标或者手指，开始计算路径和绘制路径
    touchUp(e) {
        cc.Canvas.instance.node.off(cc.Node.EventType.MOUSE_UP, this.stageUp, this);
        cc.Canvas.instance.node.off(cc.Node.EventType.MOUSE_MOVE, this.stageMove, this);
        this.moveType = 0;
        this.search();
        this.paint();
    }

    //绘制过程
    touchMove(e) {
        let touchX = Math.floor(e.getLocationX() / this.rectSize);
        let touchY = Math.floor(e.getLocationY() / this.rectSize);
        let id = `${touchX}-${touchY}`;
        if (this.moveType === 3) {
            if (!this.obstacles[id]) {
                //避免将障碍物画在起点和终点上
                if (`${this.startPoint.x}-${this.startPoint.y}` !== id && `${this.endPoint.x}-${this.endPoint.y}` !== id) {
                    this.obstacles[id] = 1;
                    this.paint();
                }
            }
        }
        else if (this.moveType === 4) {
            if (this.obstacles[id]) {
                delete (this.obstacles[id]);
                this.paint();
            }
        } else if (this.moveType === 1) {
            if (touchX !== this.startPoint.x || touchY !== this.startPoint.y) {
                if (!this.obstacles[id] && !(this.touchX === this.endPoint.x && touchY === this.endPoint.y)) {
                    this.startPoint.x = touchX;
                    this.startPoint.y = touchY;
                    this.paint();
                }
            }
        }
        else if (this.moveType === 2) {
            if (this.touchX !== this.endPoint.x || touchY !== this.endPoint.y) {
                if (!this.obstacles[id] && !(touchX === this.startPoint.x && touchY === this.startPoint.y)) {
                    this.endPoint.x = touchX;
                    this.endPoint.y = touchY;
                    this.paint();
                }

            }
        }
    }

    //A*算法
    search() {
        this.path = [];
        this.openList = {};
        this.closeList = {};

        //第一步，生成起点和终点
        let startNode = new MapNodeInfo(this.startPoint.x, this.startPoint.y);
        let endNode = new MapNodeInfo(this.endPoint.x, this.endPoint.y);

        startNode.G = 0;
        startNode.H = Math.abs(this.endPoint.x - startNode.x) + Math.abs(this.endPoint.y - startNode.y);
        startNode.F = startNode.G + startNode.H;

        //第一步，将起点放入closeList中， 并遍历起点周围的点放入openList中
        let startNodeAroundList = this.makeAroundNodeList(startNode, "open-list");

        this.openList = startNodeAroundList;
        this.closeList[`${startNode.x}-${startNode.y}-close-list`] = startNode


        while (true) {
            //第七步，若openList为空了证明没有找到路径
            if (Object.keys(this.openList).length === 0) {
                this.path = [];
                console.log("search===========");
                console.log("无法计算出路径");
                console.log("search===========");
                return;
            }
            //第五步和第六步，终点如果加入到openList中，证明已完成路径搜索
            if (this.openList[`${endNode.x}-${endNode.y}-open-list`]) {
                let endNodeOver = this.openList[`${endNode.x}-${endNode.y}-open-list`];
                let parentNode = endNodeOver.parentMapNode;
                while (parentNode) {
                    this.path.push(parentNode);
                    parentNode = parentNode.parentMapNode;
                }
                return;
            }
            //第三步和第四步过程
            //查找openList中F值最小的点
            let openListArray = Object.keys(this.openList).map((key) => { return this.openList[key] });
            openListArray.sort((a, b) => {
                if (a.F === b.F) {
                    return b.timeStamp - a.timeStamp;//时间戳判定，优先选择后加入到列表里的节点
                }
                return a.F - b.F
            });
            let firstNode = openListArray[0];
            //将其移出openList，放入closeList
            delete this.openList[`${firstNode.x}-${firstNode.y}-open-list`];
            this.closeList[`${firstNode.x}-${firstNode.y}-close-list`] = firstNode;

            //遍历此点周围的点
            let nodeAroundList = this.makeAroundNodeList(firstNode, "open-list");
            this.openList = { ...this.openList, ...nodeAroundList };
        }
    }

    makeAroundNodeList(currentNode: MapNodeInfo, suffix: String) {
        let nodeList = {};//用来存放第四步中不存在于openList中的点
        //当前方块上面的方块
        if ((currentNode.y + 1) < this.maxY && !this.obstacles[`${currentNode.x}-${currentNode.y + 1}`] && !this.checkNodeIsInList(currentNode.x, currentNode.y + 1, this.closeList)) {
            if (!this.checkNodeIsInList(currentNode.x, currentNode.y + 1, this.openList)) {
                let node = this.makeAroundNode(currentNode.x, currentNode.y + 1, currentNode);
                nodeList[`${node.x}-${node.y}-${suffix}`] = node;
            } else {
                //如果验证点周围的点已经存在于openList中，验证是否可以组成更好的路径
                let node = this.openList[`${currentNode.x}-${currentNode.y + 1}-open-list`];
                this.checkIsBetterPath(node, currentNode);
            }

        }
        //当前方块下面的方块
        if ((currentNode.y - 1) >= this.minY && !this.obstacles[`${currentNode.x}-${currentNode.y - 1}`] && !this.checkNodeIsInList(currentNode.x, currentNode.y - 1, this.closeList)) {
            if (!this.checkNodeIsInList(currentNode.x, currentNode.y - 1, this.openList)) {
                let node = this.makeAroundNode(currentNode.x, currentNode.y - 1, currentNode);
                nodeList[`${node.x}-${node.y}-${suffix}`] = node;
            } else {
                let node = this.openList[`${currentNode.x}-${currentNode.y - 1}-open-list`];
                this.checkIsBetterPath(node, currentNode);
            }
        }
        //当前方块右面的方块
        if ((currentNode.x + 1) < this.maxX && !this.obstacles[`${currentNode.x + 1}-${currentNode.y}`] && !this.checkNodeIsInList(currentNode.x + 1, currentNode.y, this.closeList)) {
            if (!this.checkNodeIsInList(currentNode.x + 1, currentNode.y, this.openList)) {
                let node = this.makeAroundNode(currentNode.x + 1, currentNode.y, currentNode);
                nodeList[`${node.x}-${node.y}-${suffix}`] = node;
            } else {
                let node = this.openList[`${currentNode.x + 1}-${currentNode.y}-open-list`];
                this.checkIsBetterPath(node, currentNode);
            }
        }
        //当前方块左面的方块
        if ((currentNode.x - 1) >= this.minX && !this.obstacles[`${currentNode.x - 1}-${currentNode.y}`] && !this.checkNodeIsInList(currentNode.x - 1, currentNode.y, this.closeList)) {
            if (!this.checkNodeIsInList(currentNode.x - 1, currentNode.y, this.openList)) {
                let node = this.makeAroundNode(currentNode.x - 1, currentNode.y, currentNode);
                nodeList[`${node.x}-${node.y}-${suffix}`] = node;
            } else {
                let node = this.openList[`${currentNode.x - 1}-${currentNode.y}-open-list`];
                this.checkIsBetterPath(node, currentNode);
            }
        }
        return nodeList;
    }

    checkNodeIsInList(x, y, list) {
        let nodeList = Object.keys(list).map((key) => { return list[key] });
        for (let i = 0; i < nodeList.length; i++) {
            let node = nodeList[i];
            if (x === node.x && y === node.y) {
                return true;
            }
        }
        return false;
    }

    makeAroundNode(x, y, currentNode) {
        let node = new MapNodeInfo(x, y);
        node.parentMapNode = currentNode;
        node.G = currentNode.G + 1;
        node.H = Math.abs(this.endPoint.x - node.x) + Math.abs(this.endPoint.y - node.y);
        node.F = node.G + node.H;
        return node;
    }

    checkIsBetterPath(node, currentNode) {
        //验证的点到周围的点需要多走一步，所以验证的点的G+1即通过验证的点到周围的点的距离，这里是4-2的操作
        if (node.G > (currentNode.G + 1)) {
            node.parentMapNode = currentNode;
            node.G = currentNode.G + 1;
            node.F = node.G + node.H;
        }
    }

    //绘制各种标识
    paint() {
        this.graphicsBody.clear();

        //大背景
        this.drawFillRect(this.graphicsBody, cc.color(255, 255, 255), this.mapRect.x, this.mapRect.y, this.mapRect.width, this.mapRect.height);
        //起点
        this.drawFillRect(this.graphicsBody, cc.color(0, 255, 100), this.rectSize * this.startPoint.x, this.rectSize * this.startPoint.y, this.rectSize, this.rectSize);
        //终点
        this.drawFillRect(this.graphicsBody, cc.color(255, 0, 0), this.rectSize * this.endPoint.x, this.rectSize * this.endPoint.y, this.rectSize, this.rectSize);
        for (let i = this.minX; i < this.maxX; i++) {
            for (let j = this.minY; j < this.maxY; j++) {
                if (this.obstacles[`${i}-${j}`]) {
                    this.drawFillRect(this.graphicsBody, cc.color(100, 100, 100), this.rectSize * i, this.rectSize * j, this.rectSize, this.rectSize);
                }
                this.graphicsBody.strokeColor = cc.color(150, 150, 150);
                this.graphicsBody.rect(this.rectSize * i, this.rectSize * j, this.rectSize, this.rectSize);
                this.graphicsBody.stroke();
            }
        }
        //绘制openList中的所有点
        let openListKeys = Object.keys(this.openList);
        for (let i = 0; i < openListKeys.length; i++) {
            let node = this.openList[openListKeys[i]];
            this.graphicsBody.strokeColor = cc.color(0, 0, 255);
            this.graphicsBody.rect(this.rectSize * node.x, this.rectSize * node.y, this.rectSize, this.rectSize);
            this.graphicsBody.stroke();
        }
        //绘制closeList中的所有点
        let closeListKeys = Object.keys(this.closeList);
        for (let i = 0; i < closeListKeys.length; i++) {
            let node = this.closeList[closeListKeys[i]];
            this.graphicsBody.strokeColor = cc.color(255, 255, 0);
            this.graphicsBody.rect(this.rectSize * node.x, this.rectSize * node.y, this.rectSize, this.rectSize);
            this.graphicsBody.stroke();
        }
        //绘制最短路径的所有点
        for (let i = 0; i < this.path.length - 1; i++) {
            let node = this.path[i];
            this.drawFillRect(this.graphicsBody, cc.color(255, 0, 255), this.rectSize * node.x, this.rectSize * node.y, this.rectSize, this.rectSize);
            // this.graphicsBody.strokeColor = cc.color(255, 0, 255);
            // this.graphicsBody.rect(this.rectSize * node.x, this.rectSize * node.y, this.rectSize, this.rectSize);
            // this.graphicsBody.stroke();
        }
    }

    drawFillRect(graphicsBody, color, x, y, width, height) {
        graphicsBody.fillColor.set(color);
        graphicsBody.fillRect(x, y, width, height);
    }


    // update (dt) {}
}
