/**
 * 走迷宫游戏的实现. (https://github.com/knightyun/maze-game)
 * Copyright 2020 knightyun. <https://raw.githubusercontent.com/knightyun/maze-game/master/maze.js>
 * MIT License. <https://raw.githubusercontent.com/knightyun/maze-game/master/LICENSE>
 */

/* 分析：
    迷宫特点：
        路与墙成对出现；
        经历保证长宽都为奇数；

    实现：
        初始全为墙，依次在其中挖路（寻路）；
        包括出入口，和四周的围墙，不在寻路范围内；
        单元格边长（正方形）：step
        迷宫总长度总格数：w；
        迷宫总高度总格数：h；

    寻路：
        寻路时只能以两格为单位前进；
        最多三个方向，每次一个方向前进两个
        
    起步位置
        (1, 1)；
        然后开始每次行进两格；

    候选路径：
        一个单元格有上下左右四个方向；
        不为墙或路的作为候选方向，最多三个，最少为 0；
        是围墙的方向排除；
        “前面” 是路的方向排除（避免挖穿墙使两条路联通）；

    判断候选方向的 “前面”：
        当前格子：(x, y)；
        候选方向：(x1, y1);
        “前面”的格子：(x2, y2) = (x1 + (x1 - x),
                                 y1 + (y1 - y))
                              = (2x1 - x, 2y1 - y)

    分叉：
        遇到围墙或路时，向左右分叉前进（两格）；
        左右存在围墙或路时，停止该方向的前进；

    停止：
        前进方向全为墙或路时停止；
        出入口视为围墙；
        全部分叉寻路停止时画迷宫结束；

    实现难度等级：
        - 控制迷宫尺寸
        - 控制最多有效候选路径条数
            - 1 - 简单
            - 2 - 困难
            - 3 - 复杂
*/

class Maze {
    /**
     * @constructor
     * @param {Element}  elMaze        承载迷宫的 canvas 元素
     * @param {Element}  elBall        绘制小球的元素
     * @param {number}   ballDia       小球的直径（像素）
     * @param {number}   w             迷宫宽度（格数）
     * @param {number}   h             迷宫高度（格数）
     * @param {*}        step          单元格大小
     * @param {function} keyHandler    键盘控制移动回调函数
     * @param {function} motionHandler 手机控制移动回调函数
     * @memberof Maze
     */
    constructor(elMaze, elBall, ballDia, w, h, step, keyHandler, motionHandler) {
        this.w             = w;
        this.h             = h;
        this.step          = step;
        this.elMaze        = elMaze;
        this.elBall        = elBall;
        this.ballDia       = ballDia;
        this.keyHandler    = keyHandler;
        this.motionHandler = motionHandler;

        this.ballSpeedX = 0;    // 小球 x 轴方向的移动速度；
        this.ballSpeedY = 0;    // 小球 y 轴方向的移动速度；
        this.G          = 9.8;  // 重力加速度
        this.time       = null; // 时间戳，用于设置重力加速度
        
        // 游戏难度等级：
        //   0 - 简单：随机返回一个候选方向；
        //   1 - 困难：随机返回两个候选方向；
        //   2 - 复杂：随机返回三个候选方向；（全部）
        // this.gameLevel = +elGameLevel.value;
        this.gameLevel = 0;
        
        this.cvsCtx = this.elMaze.getContext('2d');

        // 包含所有格子的二维数组
        this.mazeGrids = [];

        // 入口位置
        this.entrance = {
            x: 1,
            y: 0
        }

        // 出口位置
        this.exit = {
            x: w - 2,
            y: h - 1
        }

        this.initMaze();
    }

    /**
     * 初始化迷宫
     *
     * @memberof Maze
     */
    initMaze() {
        var mazeGrids = this.mazeGrids,
            w = this.w,
            h = this.h,
            step = this.step,
            elMaze = this.elMaze,
            elBall = this.elBall,
            ballDia = this.ballDia,
            entrance = this.entrance,
            exit = this.exit;

        // 调整 canvas 元素尺寸
        elMaze.width = w * step;
        elMaze.height = h * step;

        // 绘画初始迷宫，包括围墙，出入口，
        // 并初始化每个单元格的信息
        for (var y = 0; y < h; y++) {

            mazeGrids[y] = [];

            for (var x = 0; x < w; x++) {

                // 每个单元格的信息，包括坐标，是否为墙，是否为路
                mazeGrids[y][x] = {
                    // 格子坐标
                    x: x,
                    y: y,
                    // 判断是否是围墙
                    isWall: (x === 0 || y === 0 ||
                        x === w - 1 ||
                        y === h - 1),
                    // 是否为入口
                    isEntrance: x === entrance.x &&
                        y === entrance.y,
                    // 是否为出口
                    isExit: x === exit.x &&
                        y === exit.y,
                    // 判断是否为路：后期画路时置为 true
                    isPath: false
                }
            }
        }

        // 画墙和出入口
        this.drawWall('black', 'white');

        // 挖路
        this.drawPath(entrance, { x: 1, y: -1 }, 'white');

        // 画小球
        this.drawBall(elBall, ballDia, 'red');
    }

    /**
     * 封装的画格子方法
     *
     * @param {number} x 左上角的 x 坐标
     * @param {number} y 左上角的 y 坐标
     * @param {string} color 格子颜色
     * @memberof Maze
     */
    fillGrid(x, y, color) {
        var ctx = this.cvsCtx;

        ctx.fillStyle = color;
        ctx.fillRect(x * this.step, y * this.step,
            this.step, this.step);
    }

    /**
     * 获取当前格子的“前面”一个格子（相对）
     *
     * @param   {number} x1 前一个格子的 x 坐标
     * @param   {number} y1 前一个格子的 y 坐标
     * @param   {number} x2 当前格子的 x 坐标
     * @param   {number} y2 当前格子的 y 坐标
     * @returns {object}    迷宫格子对象
     * @memberof Maze
     */
    getFrontGrid(x1, y1, x2, y2) {
        var x = 2 * x2 - x1,
            y = 2 * y2 - y1;

        // 判断该格子是否存在；
        var isExist = !!this.mazeGrids[y] &&
            !!this.mazeGrids[y][x];

        return isExist ? this.mazeGrids[y][x] : null;
    }

    /**
     * 获取当前格子的左前方一个格子（相对）
     *
     * @param   {number} x1 前一个格子的 x 坐标
     * @param   {number} y1 前一个格子的 y 坐标
     * @param   {number} x2 当前格子的 x 坐标
     * @param   {number} y2 当前格子的 y 坐标
     * @returns {object}    迷宫格子对象
     * @memberof Maze
     */
    getFrontLeftGrid(x1, y1, x2, y2) {
        // 先获取前方格子
        var x = 2 * x2 - x1,
            y = 2 * y2 - y1;

        // 再判断左前方
        if (x2 - x1 === 0) {
            if (y2 - y1 > 0)
                x += 1;
            else
                x -= 1;
        }

        if (y2 - y1 === 0) {
            if (x2 - x1 > 0)
                y -= 1;
            else
                y += 1;
        }

        // 判断该格子是否存在；
        var isExist = !!this.mazeGrids[y] &&
            !!this.mazeGrids[y][x];

        return isExist ? this.mazeGrids[y][x] : null;
    }

    /**
     * 获取当前格子的右前方一个格子（相对）
     *
     * @param   {number} x1 前一个格子的 x 坐标
     * @param   {number} y1 前一个格子的 y 坐标
     * @param   {number} x2 当前格子的 x 坐标
     * @param   {number} y2 当前格子的 y 坐标
     * @returns {object}    迷宫格子对象
     * @memberof Maze
     */
    getFrontRightGrid(x1, y1, x2, y2) {
        // 先获取前方格子
        var x = 2 * x2 - x1,
            y = 2 * y2 - y1;

        // 再判断右前方
        if (x2 - x1 === 0) {
            if (y2 - y1 > 0)
                x -= 1;
            else
                x += 1;
        }

        if (y2 - y1 === 0) {
            if (x2 - x1 > 0)
                y += 1;
            else
                y -= 1;
        }

        // 判断该格子是否存在；
        var isExist = !!this.mazeGrids[y] &&
            !!this.mazeGrids[y][x];

        return isExist ? this.mazeGrids[y][x] : null;
    }

    /**
     * 获取当前格子的所有有效候选方向
     *
     * @param   {*} x   当前格子 x 坐标
     * @param   {*} y   当前格子 y 坐标
     * @returns {Array} 有效的候选方向（格子对象）
     * @memberof Maze
     */
    getValidDirections(x, y) {
        // 格子周围有上右下左四个方向,
        // 索引 0, 1, 2, 3，
        // 无效方向：
        //   格子为围墙；
        //   格子前面是路；
        // 如果领居数为 0，则寻路结束； 

        var mazeGrids = this.mazeGrids,
            directions = [];

        // 4 个方向
        var top = {
                x: x,
                y: y - 1
            },
            bottom = {
                x: x,
                y: y + 1
            },
            left = {
                x: x - 1,
                y: y
            },
            right = {
                x: x + 1,
                y: y
            }

        directions.push(top, bottom, left, right);

        // 过滤掉无效方向
        directions = directions.filter(item => {

            // 候选方向的 x, y 坐标
            var _x = item.x,
                _y = item.y;

            // 判断是否到达出口

            // 判断是否为有效方向（按顺序判断）：
            //     格子存在；
            //     格子是出口；
            //     格子不是围墙；
            //     格子不是路；
            //     前方格子存在；
            //     前方格子不是路；
            var isValidDirection,
                isExist,
                isExit,
                isWall,
                isPath,
                isFrontExist,
                isFrontPath;

            // 是出口直接返回
            isExit = mazeGrids[_y][_x].isExit;

            if (isExit) return true;

            isExist = !!mazeGrids[_y] && !!mazeGrids[_y][_x];
            isFrontExist = !!this.getFrontGrid(x, y, _x, _y);

            // 格子不存在直接排除
            if (!isExist || !isFrontExist) return false;

            isWall = mazeGrids[_y][_x].isWall;
            isPath = mazeGrids[_y][_x].isPath;
            isFrontPath = this.getFrontGrid(x, y, _x, _y).isPath;

            isValidDirection = isExit || !isWall && !isPath && !isFrontPath;


            return isValidDirection;
        });

        // 转换为迷宫格子对象
        directions = directions.map(item => {
            return mazeGrids[item.y][item.x];
        })

        return directions;
    }

    /**
     * 判断第三个格子相对于第二个格子的方位
     *
     * @param   {object} grid1 格子对象
     * @param   {object} grid2 格子对象
     * @param   {object} grid2 格子对象
     * @returns {string='front'|'left'|'right'} 方位 
     * @memberof Maze
     */
    getDirection(grid1, grid2, grid3) {
        var directions = ['front', 'left', 'right'];

        var x1 = grid1.x,
            y1 = grid1.y,
            x2 = grid2.x,
            y2 = grid2.y,
            x3 = grid3.x,
            y3 = grid3.y;

        var isFront, isLeft, isRight;

        isFront = (x3 - x2 === x2 - x1) ||
            (y3 - y2 === y2 - y1);

        if (y2 === y1) {
            if (x2 > x1) {
                if (x3 === x2 && y3 < y2) isLeft = true;
                if (x3 === x2 && y3 > y2) isRight = true;
            } else {
                if (x3 === x2 && y3 > y2) isLeft = true;
                if (x3 === x2 && y3 < y2) isRight = true;
            }
        }

        if (x2 === x1) {
            if (y2 > y1) {
                if (y3 === y2 && x3 > x2) isLeft = true;
                if (y3 === y2 && x3 < x2) isRight = true;
            } else {
                if (y3 === y2 && x3 < x2) isLeft = true;
                if (y3 === y2 && x3 > x2) isRight = true;
            }
        }

        if (isFront) return directions[0];
        if (isLeft) return directions[1];
        if (isRight) return directions[2];
    }

    /**
     * 随机返回一个候选方向
     *
     * @param   {Array} directions 包含候选方向的数组
     * @returns {object[]}         一个包含随机的候选方向的数组
     * @memberof Maze
     */
    getRandomDirection(directions) {
       // var len = directions.length;
        var results = [];

        // 随机候选方向的索引
        //var idx = Math.round(Math.random() * (len - 1));
        
        // 打乱数组
        directions.sort(() => (0.5 - Math.random()));
        
        // 根据游戏难度返回候选方向
        // 
        for (let i = 0; i <= this.gameLevel; i++) {
            // 如果候选方向个数少于相应游戏难度的，
            // 则直接中断
            if (!directions[i]) break;
            
            results.push(directions[i]);
        }

        return results;
    }

    /**
     * 处理当前格子下一步路径分叉的问题
     *
     * @param   {object}   grid1      前一个格子对象
     * @param   {object}   grid2      当前格子对象
     * @param   {object[]} directions 候选方向的格子对象
     * @returns {object[]}            返回确定要挖的格子对象
     * @memberof Maze
     */
    forkPath(grid1, grid2, directions) {
        // 判断是否需要路径分叉：（按顺序）
        //   前方是围墙（分左、右）；
        //   前方的前方是路（分左、右）；
        //   左前方的左前方是路（分前、左）；
        //   右前方的右前方是路（分前、右）；
        //   左右前方的前方都是路（分前、左、右）；
        // 前方是围墙、或前方的前方是路、或左右前方的前方都是路，
        // 则所有候选方向都要挖；
        // 左右前方的前方其中一个为路时，只能挖前方和左或右；
        // 以上情况都不是，则使用随机选择；

        var isFrontWall,
            isFrontPath,
            isFrontLeftPath,
            isFrontRightPath;

        // 标记每个候选方向的方位
        var _directions = {
            front: null,
            left: null,
            right: null
        }

        // 处理随机获取候选方向的东西情况
        var randomDirections = [],
            flagRandom = false;

        // 最后汇总返回的方向
        var returnDirections = [];

        // 遍历判断 directions 的方位
        directions.forEach(grid => {
            var direction = this.getDirection(grid1, grid2, grid);

            _directions[direction] = grid;
        })


        // 现获取前面的格子
        // 前面一定存在有效格子
        // 不存在是路的情况
        // 如果是围墙直接返回全部方向，不用继续判断
        var frontGrid = this.getFrontGrid(grid1.x, grid1.y,
            grid2.x, grid2.y);
        isFrontWall = frontGrid.isWall;

        if (isFrontWall) return directions;


        // 获取前面的前面的格子
        // 此时前面的前面也一定存在有效格子
        // 不存在是围墙的情况
        // 如果是路直接返回全部对象，不判断左右
        var frontFrontGrid = this.getFrontGrid(grid2.x, grid2.y,
            frontGrid.x, frontGrid.y);
        isFrontPath = frontFrontGrid.isPath;

        if (isFrontPath) return directions;


        // 此时前方的前方不是路，也不会是围墙，
        // 只会是待挖的路，所以需要返回 front 方位的候选方向
        // 并考虑获取随机方向的情况
        returnDirections.push(_directions['front']);
        randomDirections.push(_directions['front']);


        // 获取左前方的左前方的格子
        // 左前方一定存在有效格子
        var frontLeftGrid = this.getFrontLeftGrid(grid1.x, grid1.y,
            grid2.x, grid2.y);
        if (!frontLeftGrid.isWall && !!_directions['left']) {
            // 如果左前方是围墙，或者左边没有候选方向，
            // 则跳过；

            // 否则继续判断左前方的左前方
            // 此时左前方的左前方一定不会是围墙
            var frontFrontLeftGrid = this.getFrontLeftGrid(grid2.x, grid2.y,
                frontLeftGrid.x, frontLeftGrid.y);

            if (frontFrontLeftGrid.isPath) {

                // 如果是路，则需要返回 left 方位的候选方向
                returnDirections.push(_directions['left']);
                isFrontLeftPath = true;
            } else {

                // 如果不是，就要考虑随机选择 front, left
                randomDirections.push(_directions['left']);
                isFrontLeftPath = false;
            }
        } else {

            // 标记为不是路，方便处理另外两个方向可能出现随机的情况
            isFrontLeftPath = false;
        }


        // 获取右前方的左前方的格子
        // 右前方一定存在有效格子
        var frontRightGrid = this.getFrontRightGrid(grid1.x, grid1.y,
            grid2.x, grid2.y);
        if (!frontRightGrid.isWall && !!_directions['right']) {
            // 如果右前方也是墙（很难出现）且存在右侧候选方向，
            // 则跳过

            // 否则继续判断右前方的左前方
            // 此时右前方的右前方一定不会是围墙
            var frontFrontRightGrid = this.getFrontRightGrid(grid2.x, grid2.y,
                frontRightGrid.x, frontRightGrid.y);

            if (frontFrontRightGrid.isPath) {

                // 如果也是路，则需要返回 right 方位的候选方向
                returnDirections.push(_directions['right']);
                isFrontRightPath = true;
            } else {

                // 如果不是，就要考虑随机选择 front, right
                // 如果 left 方位也要考虑随机，则随机选择 front, left, right
                randomDirections.push(_directions['right']);
                isFrontRightPath = false;
            }

        } else {
            isFrontRightPath = false;
        }

        // 使用随机的情况：
        //   前方的前方不是路（可以挖）；
        //   左右前方的前方只有一个是路时，选择前面和另一个不是路的方位；
        //   左右前方的前方都不是路时，randomDirections 中随机选一个；
        // 否则返回全部方向
        flagRandom = !isFrontLeftPath && !isFrontRightPath;

        if (flagRandom)
            return this.getRandomDirection(randomDirections);
        else
            return returnDirections;
    }

    /**
     * 绘画四周的围墙，以及出入口
     *
     * @param {string} wallColor   围墙的颜色
     * @param {string} tunnelColor 出入口的颜色
     * @memberof Maze
     */
    drawWall(wallColor, tunnelColor) {
        this.mazeGrids.forEach(y => {
            y.forEach(x => {

                // 画墙
                x.isWall &&
                    this.fillGrid(x.x, x.y, wallColor);

                // 画出入口
                x.isEntrance &&
                    this.fillGrid(x.x, x.y, tunnelColor);
                x.isExit &&
                    this.fillGrid(x.x, x.y, tunnelColor);
            })
        })
    }

    /**
     * 挖路实现函数，递归地绘制有效路径
     * 从 this.start 开始，到无路后结束
     *
     * @param {object} grid      当前格子对象（要挖的路）
     * @param {object} preGrid   前一个格子对象，
     *                           用于获取前进两格需要的方向
     * @param {string} pathColor 路的颜色
     * @param {object} ctx       保存当前类的上下文，
     *                           方便使用计时器时获取上下文
     * @memberof Maze
     */
    drawPath(grid, preGrid, pathColor, ctx) {
        var x = grid.x,
            y = grid.y,
            preX = preGrid.x,
            preY = preGrid.y;

        ctx = ctx || this;

        var mazeGrids = ctx.mazeGrids;

        // 绘制路
        ctx.fillGrid(x, y, pathColor);

        // 标记当前格子为路
        mazeGrids[y][x].isPath = true;

        // 是出口则直接停止
        if (mazeGrids[y][x].isExit) {
            console.log('find exit.');
            return;
        }

        // 获取前面方向的格子
        var fwdGrid = ctx.getFrontGrid(preX, preY, x, y);
        var fwdX = fwdGrid.x,
            fwdY = fwdGrid.y;

        // 画同方向第二格路
        ctx.fillGrid(fwdX, fwdY, pathColor)
        mazeGrids[fwdY][fwdX].isPath = true;


        // 获取候选方向（第二格的）
        var directions = ctx.getValidDirections(fwdX, fwdY);

        // 递归挖路结束
        if (directions.length === 0) {
            return;
        }

        // 标记候选方向
        // for (let i = 0;  i < directions.length; i++) {
        //     ctx.fillGrid(directions[i].x, directions[i].y, 'rgba(0, 255, 0, .3)');
        // }

        // 处理分叉情况，获取最终要挖的所有方向
        directions = ctx.forkPath(grid, fwdGrid, directions);

        // 标记选择方向
        // for (let i = 0;  i < directions.length; i++) {
        //     ctx.fillGrid(directions[i].x, directions[i].y, 'rgba(0, 0, 255, .3)');
        // }

        for (let i = 0; i < directions.length; i++) {
            // debug
            setTimeout(ctx.drawPath, 1000, directions[i],
                        mazeGrids[fwdY][fwdX], pathColor, ctx);

            // normal
            /*
            ctx.drawPath(directions[i], mazeGrids[fwdY][fwdX],
                pathColor, ctx);*/
        }
    }

    /**
     * 画出走迷宫的小球
     *
     * @param {Element} elBall    用于绘制小球的元素
     * @param {number}  d         小球的直径
     * @param {string}  ballColor 小球的颜色
     * @memberof Maze
     */
    drawBall(elBall, d, ballColor) {

        // 初始化小球坐标
        this.ballX = this.entrance.x * this.step;
        this.ballY = this.entrance.y * this.step;

        // 初始化位置、大小、颜色
        elBall.style.width = d + 'px';
        elBall.style.height = d + 'px';
        elBall.style.left = this.ballX + 'px';
        elBall.style.top = this.ballY + 'px';
        elBall.style.background = ballColor;

    }

    /**
     * 实现移动控制小球
     *
     * @param {number} x  x 轴方向的重力加速度比率，10 >= x >= -10
     *                    值的绝对值越大，越接近重力加速度
     * @param {number} y  y 轴方向的重力加速度比率，10 >= y >= -10
     *                    值的绝对值越大，越接近重力加速度
     * @memberof Maze
     */
    moveBall(x, y) {
        var elBall = this.elBall;

        // 未移动时的坐标
        var bx = this.ballX,
            by = this.ballY;

        // 应用重力加速度：
        // 每秒速度增加量等于重力加速度；
        // 加速度的大小与倾斜角度（近似为 x，y 的值）成正比；
        // 时间戳单位为 1/1000 秒，
        // 重力加速度则为 G / 1000；

        // 不同轴方向换算后的加速度
        var gX = (this.G / 1000) * (x / 10),
            gY = (this.G / 1000) * (y / 10);

        // 当前时间戳
        var time = Date.now();

        // 每次调用根据时间戳确定要移动的距离
        if (!this.time) {
            this.time = time;
        } else {

            // 两次调用的时间间隔
            var timeDur = time - this.time;

            // 时间间隔阈值，超过这个值判断为小球停止后重新移动，
            // 此时速度需要置 0
            var timeout = 50;

            // 根据重力加速度增加速度
            if (!x || timeDur > timeout) {

                // 如果该方向没有移动，则速度置为 0
                this.ballSpeedX = 0;
            } else {

                // 否则速度加上一个加速度值
                this.ballSpeedX += timeDur * gX;
            }

            if (!y || timeDur > timeout) {
                this.ballSpeedY = 0;
            } else {
                this.ballSpeedY += timeDur * gY;
            }
        }

        this.time = time;

        // 移动后的坐标
        bx += this.ballSpeedX,
        by += this.ballSpeedY;

        // 把小球变换后的坐标限制在路内（防止穿墙）
        var validPos = this.getBallValidPosition(bx, by);

        // 保存变换后的坐标
        this.ballX = validPos.x;
        this.ballY = validPos.y;

        // 判断是否到达出口
        if (this.ballX >= (this.exit.x * this.step) &&
            this.ballY >= (this.exit.y * this.step)) {
            this.arriveExit();
        }
        // 移动小球
        elBall.style.left = this.ballX + 'px';
        elBall.style.top  = this.ballY + 'px';
    }

    /**
     * 限制小球移动范围，返回限制后的有效坐标
     *
     * @param   {number} x   变换后的小球 x 坐标
     * @param   {number} y   变换后的小球 y 坐标
     * @returns {object}     限制后的 x，y 坐标
     * @memberof Maze
     */
    getBallValidPosition(x, y) {

        // 限制小球在迷宫范围内
        if (x <= 0) x = 0, this.ballSpeedX = 0;
        if (y <= 0) y = 0;

        if (x >= this.w * this.step - this.ballDia)
            x = this.w * this.step - this.ballDia, this.ballSpeedX = 0;

        if (y >= this.h * this.step - this.ballDia)
            y = this.h * this.step - this.ballDia;

        // 小球四个角的坐标转换为迷宫坐标，
        // 即除以单元格长度后去掉小数部分
        // 刚好接触墙判断为路
        var leftTop = {
                x: ~~(x / this.step),
                y: ~~(y / this.step)
            },
            leftBottom = {
                x: ~~(x / this.step),
                y: ~~((y + this.ballDia) / this.step)
            },
            rightTop = {
                x: ~~((x + this.ballDia) / this.step),
                y: ~~(y / this.step)
            },
            rightBottom = {
                x: ~~((x + this.ballDia) / this.step),
                y: ~~((y + this.ballDia) / this.step)
            }

        // 判断每个角对应的迷宫格子是否是路
        // 格子不存在就视作墙
        var that = this;

        function isGridPath(grid) {
            var x = grid.x,
                y = grid.y;

            var isPath = that.mazeGrids[y] &&
                that.mazeGrids[y][x] &&
                that.mazeGrids[y][x].isPath;

            return isPath;
        }

        // 小球穿墙的情况：
        //   1. 只有一个角穿墙，需要考虑移动方向；
        //   2. 只有两个角穿墙，一定在同一侧；
        //   3. 三个角同时穿墙（暂时不考虑）；

        // 1. 一个角穿墙，向坐标值更大的一个轴方向移动
        // 1.1. 左上角
        if (!isGridPath(leftTop) && isGridPath(leftBottom) &&
            isGridPath(rightTop) && isGridPath(rightBottom)) {

            // 向左穿墙
            if (x - leftTop.x * this.step >
                y - leftTop.y * this.step)
                x = (leftTop.x + 1) * this.step, this.ballSpeedX = 0;
            // 向上穿墙
            else
                y = (leftTop.y + 1) * this.step, this.ballSpeedY = 0;
        }
        // 1.2. 左下角
        if (!isGridPath(leftBottom) && isGridPath(leftTop) &&
            isGridPath(rightBottom) && isGridPath(rightTop)) {

            // 向左穿墙
            if ((leftBottom.x + 1) * this.step - x <
                y + this.ballDia - leftBottom.y * this.step)
                x = (leftBottom.x + 1) * this.step, this.ballSpeedX = 0;
            // 向下穿墙
            else
                y = leftBottom.y * this.step - this.ballDia, this.ballSpeedY = 0;
        }
        // 1.3. 右下角
        if (!isGridPath(rightBottom) && isGridPath(rightTop) &&
            isGridPath(leftBottom) && isGridPath(leftTop)) {

            // 向右穿墙
            if (y + this.ballDia - rightBottom.y * this.step >
                x + this.ballDia - rightBottom.x * this.step)
                x = rightBottom.x * this.step - this.ballDia, this.ballSpeedX = 0;
            // 向下穿墙
            else
                y = rightBottom.y * this.step - this.ballDia, this.ballSpeedY = 0;
        }
        // 1.4. 右上角
        if (!isGridPath(rightTop) && isGridPath(rightBottom) &&
            isGridPath(leftTop) && isGridPath(leftBottom)) {

            // 向右穿墙
            if ((rightTop.y + 1) * this.step - y >
                x + this.ballDia - rightTop.x * this.step)
                x = rightTop.x * this.step - this.ballDia, this.ballSpeedX = 0;
            // 向上穿墙
            else
                y = (rightTop.y + 1) * this.step, this.ballSpeedY = 0;
        }

        // 2. 同侧两个角穿墙
        // 2.1. 左侧
        if (!isGridPath(leftTop) && !isGridPath(leftBottom))
            x = (leftTop.x + 1) * this.step, this.ballSpeedX = 0;
        // 2.2. 下侧
        if (!isGridPath(leftBottom) && !isGridPath(rightBottom))
            y = leftBottom.y * this.step - this.ballDia, this.ballSpeedY = 0;
        // 2.3. 右侧
        if (!isGridPath(rightTop) && !isGridPath(rightBottom))
            x = rightTop.x * this.step - this.ballDia, this.ballSpeedX = 0;
        // 2.4. 上侧
        if (!isGridPath(leftTop) && !isGridPath(rightTop))
            y = (leftTop.y + 1) * this.step, this.ballSpeedY = 0;

        return { x, y }
    }

    /**
     * 开始移动，添加事件监听
     *
     * @memberof Maze
     */
    startMove() {
        // 监控键盘移动事件
        window.addEventListener('keydown', this.keyHandler);
        
        // 监控移动端重力感应器事件
        window.addEventListener('devicemotion', this.motionHandler);
    }
 
    /**
     * 小球到达出口后的操作
     *
     * @memberof Maze
     */
    arriveExit() {
        console.log('arrive exit.');

        // 停止控制小球
        window.removeEventListener('keydown',      this.keyHandler);
        window.removeEventListener('devicemotion', this.motionHandler);

        // 信息提示
        M.toast({
            html: `<span class="orange-text text-accent-4">
                     ✨恭喜抵达出口🎉！请重新开始游戏
                   </span>`,
            displayLength: 3000
        })
    }
}

/**
 * 处理键盘移动事件的回调函数
 *
 * @param {Event} evt 传入的事件对象
 */
function keyDownHandler(evt) {
    // 上      左        下        右
    // w       a         s         d
    // ArrowUp ArrowLeft ArrowDown ArrowRight

    // 不同方向的移动加速度比率 [0, 10]
    var step = 5;

    switch (evt.key) {
        case 'w':
        case 'ArrowUp':
            maze.moveBall(0, -step);
            break;

        case 'a':
        case 'ArrowLeft':
            maze.moveBall(-step, 0);
            break;

        case 's':
        case 'ArrowDown':
            maze.moveBall(0, step);
            break;

        case 'd':
        case 'ArrowRight':
            maze.moveBall(step, 0);
            break;

        default:
            break;
    }
}

/**
 * 处理移动端重力感应移动事件的回调
 *
 * @param {Event} evt 传入的事件对象
 */
function deviceMotionHandler(evt) {
    var acc = evt.accelerationIncludingGravity;

    // 右翻 x 为负，后翻 y 为正
    // 不同方向的重力加速度比率，范围 [-10, 10]
    var ax = -acc.x,
        ay = acc.y;

    maze.moveBall(ax, ay);
}

// 开始新游戏
function restartGame() {
    // 重新生成迷宫并移动小球
    maze = new Maze(elMaze, elBall, 5, 31, 31, 10,
                    keyDownHandler, deviceMotionHandler);
    maze.startMove();
}

// 开始游戏
function startGame() {
    // 开始移动小球
    maze.startMove();
    
    elStartGame.classList.add('disabled');

    M.toast({
        html: '<span class="teal-text text-accent-2">游戏开始！</span>',
        displayLength: 1000
    })
}

var elMaze = document.querySelector('#maze-map');
var elBall = document.querySelector('#maze-ball');
var elStartGame = document.querySelector('.start-game');
var elGameLevel = document.querySelector('.game-level');

var maze = new Maze(elMaze, elBall, 5, 31, 31, 10,
                    keyDownHandler, deviceMotionHandler);

if (typeof DeviceMotionEvent === 'undefined')
    alert('浏览器不支持重力感应器！');