document.addEventListener('DOMContentLoaded', () => {
    const mazeContainer = document.getElementById('maze-container');
    const generateBtn = document.getElementById('generate-btn');
    const solveBtn = document.getElementById('solve-btn');
    const gridSizeInput = document.getElementById('gridSize');
    const speedInput = document.getElementById('speed');
    const statusDiv = document.getElementById('status');

    let grid = [];
    let rows, cols;
    let startNode = null;
    let endNode = null;
    let isGenerating = false;
    let isSolving = false;
    let visualizationDelay = 50; // Default delay in ms
    let animationFrameId = null; // To potentially cancel visualization

    const CELL_SIZE = 20; // Pixel size of each cell

    // --- Node Class for A* ---
    class Node {
        constructor(row, col, isWall = false) {
            this.row = row;
            this.col = col;
            this.isWall = isWall;
            this.g = Infinity; // Cost from start node
            this.h = 0;        // Heuristic cost to end node
            this.f = Infinity; // Total cost (g + h)
            this.parent = null;
            this.isStart = false;
            this.isEnd = false;
        }

        reset() {
            this.g = Infinity;
            this.h = 0;
            this.f = Infinity;
            this.parent = null;
            // isWall, isStart, isEnd remain the same unless maze is regenerated
        }

        getElement() {
            return document.getElementById(`cell-${this.row}-${this.col}`);
        }

        updateVisual(className, add = true) {
            const element = this.getElement();
            if (element) {
                if (add) {
                    // Avoid overriding start/end visuals during solving phases
                    if (!(this.isStart || this.isEnd)) {
                         element.classList.add(className);
                    }
                    // Allow specific overrides if needed (like final path)
                    if (className === 'path-final') {
                         element.classList.remove('open', 'closed', 'current');
                         element.classList.add('path-final');
                    }
                } else {
                    element.classList.remove(className);
                }
            }
        }
    }

    // --- Maze Generation (Randomized DFS) ---
    function generateMaze() {
        if (isGenerating || isSolving) return;
        isGenerating = true;
        statusDiv.textContent = "Generating Maze...";
        disableControls(true);
        clearVisualization(); // Clear previous solve states

        rows = parseInt(gridSizeInput.value);
        cols = parseInt(gridSizeInput.value);
        // Ensure odd dimensions for better maze structure with DFS
        if (rows % 2 === 0) rows++;
        if (cols % 2 === 0) cols++;
        gridSizeInput.value = rows; // Update input if changed

        visualizationDelay = parseInt(speedInput.value);

        // 1. Initialize grid with all walls
        grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) {
                grid[r][c] = new Node(r, c, true); // Start with all walls
            }
        }

        // 2. Choose a starting point (must be odd coordinates for this algo)
        const startR = 1;
        const startC = 1;
        grid[startR][startC].isWall = false;

        const stack = [[startR, startC]];

        while (stack.length > 0) {
            const [r, c] = stack[stack.length - 1]; // Peek
            const neighbors = [];

            // Check potential neighbors (2 steps away)
            const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];
            for (const [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;

                if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc].isWall) {
                    neighbors.push([nr, nc]);
                }
            }

            if (neighbors.length > 0) {
                // Choose a random neighbor
                const [nextR, nextC] = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Carve path to the neighbor
                const wallR = r + (nextR - r) / 2;
                const wallC = c + (nextC - c) / 2;
                grid[wallR][wallC].isWall = false; // Remove wall in between
                grid[nextR][nextC].isWall = false; // Mark neighbor as path

                stack.push([nextR, nextC]); // Move to the neighbor
            } else {
                stack.pop(); // Backtrack
            }
        }

        // 3. Set Start and End Nodes (ensure they are not walls)
        startNode = grid[1][1];
        startNode.isStart = true;
        startNode.isWall = false; // Ensure start is path

        endNode = grid[rows - 2][cols - 2]; // Usually bottom-right corner
        endNode.isEnd = true;
        endNode.isWall = false; // Ensure end is path

        drawGrid();
        statusDiv.textContent = "Maze Generated. Ready to Solve.";
        isGenerating = false;
        disableControls(false);
        solveBtn.disabled = false; // Re-enable solve button
    }

    // --- Drawing the Grid ---
    function drawGrid() {
        mazeContainer.innerHTML = ''; // Clear previous grid
        mazeContainer.style.gridTemplateColumns = `repeat(${cols}, ${CELL_SIZE}px)`;
        mazeContainer.style.gridTemplateRows = `repeat(${rows}, ${CELL_SIZE}px)`;
        mazeContainer.style.width = `${cols * CELL_SIZE}px`;
        mazeContainer.style.height = `${rows * CELL_SIZE}px`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                const node = grid[r][c];
                cell.id = `cell-${r}-${c}`;
                cell.classList.add('cell');
                cell.style.width = `${CELL_SIZE}px`;
                cell.style.height = `${CELL_SIZE}px`;

                if (node.isWall) cell.classList.add('wall');
                if (node.isStart) cell.classList.add('start');
                if (node.isEnd) cell.classList.add('end');

                mazeContainer.appendChild(cell);
            }
        }
    }

    // --- A* Algorithm ---
    async function solveMaze() {
        if (isSolving || isGenerating || !startNode || !endNode) return;
        isSolving = true;
        statusDiv.textContent = "Solving...";
        disableControls(true);
        clearVisualization(false); // Clear previous solve visuals, but keep maze structure

        visualizationDelay = parseInt(speedInput.value);

        const openSet = []; // Use array as a min-heap (simplification)
        const closedSet = new Set(); // Efficient checking if node was visited

        // Reset nodes for solving
        grid.flat().forEach(node => node.reset());

        startNode.g = 0;
        startNode.h = heuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;
        openSet.push(startNode);
        startNode.updateVisual('open');

        let pathFound = false;

        while (openSet.length > 0) {
            // Find node with lowest f score in openSet
            openSet.sort((a, b) => a.f - b.f);
            const currentNode = openSet.shift(); // Get and remove best node

            currentNode.updateVisual('open', false); // Remove from open visual
            currentNode.updateVisual('current');    // Mark as current

            // --- Visualization Delay ---
            await sleep(visualizationDelay);
            // ---------------------------

            if (currentNode === endNode) {
                pathFound = true;
                await reconstructPath(currentNode);
                statusDiv.textContent = "Path Found!";
                break; // Exit loop
            }

             currentNode.updateVisual('current', false); // Unmark current
             currentNode.updateVisual('closed');     // Mark as closed
             closedSet.add(currentNode);


            const neighbors = getNeighbors(currentNode);

            for (const neighbor of neighbors) {
                if (neighbor.isWall || closedSet.has(neighbor)) {
                    continue; // Skip walls and already evaluated nodes
                }

                const tentativeG = currentNode.g + 1; // Assume cost of 1 between neighbors

                let newPathFound = false;
                if (!openSet.includes(neighbor)) {
                    newPathFound = true;
                    neighbor.h = heuristic(neighbor, endNode);
                    openSet.push(neighbor);
                     neighbor.updateVisual('open'); // Visualize new node in open set
                } else if (tentativeG >= neighbor.g) {
                    continue; // This path is not better
                }

                // This path is the best until now. Record it!
                neighbor.parent = currentNode;
                neighbor.g = tentativeG;
                neighbor.f = neighbor.g + neighbor.h;

                 // If it was already in openSet, it might need resort, but simple array sort handles this
                 // If we used a proper MinHeap, we'd update its position here.
            }
             // Small delay after processing neighbors for better visualization flow
             await sleep(Math.max(1, Math.floor(visualizationDelay / 5)));
        }

        if (!pathFound) {
            statusDiv.textContent = "No Path Found!";
        }

        isSolving = false;
        disableControls(false); // Re-enable generate button
        // Keep solve button disabled until new maze? Or allow re-solve? Let's allow re-gen for now.
        // solveBtn.disabled = true;
    }

    // --- Helper Functions ---

    function heuristic(nodeA, nodeB) {
        // Manhattan distance
        return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
    }

    function getNeighbors(node) {
        const neighbors = [];
        const { row, col } = node;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // Up, Down, Left, Right

        for (const [dr, dc] of directions) {
            const nr = row + dr;
            const nc = col + dc;

            // Check bounds
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push(grid[nr][nc]);
            }
        }
        return neighbors;
    }

    async function reconstructPath(endNode) {
        statusDiv.textContent = "Drawing Path...";
        let currentNode = endNode;
        const path = [];
        while (currentNode !== null) {
            path.push(currentNode);
            currentNode = currentNode.parent;
        }
        path.reverse(); // Path from start to end

        for (const node of path) {
            if (!node.isStart && !node.isEnd) {
                 node.updateVisual('path-final');
                 await sleep(visualizationDelay / 2); // Draw path slightly faster
            }
        }
    }

     function clearVisualization(clearMazeStructure = true) {
        if (animationFrameId) {
            clearTimeout(animationFrameId); // Using timeout ID now
            animationFrameId = null;
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const node = grid[r]?.[c];
                if (node) {
                    const element = node.getElement();
                    if (element) {
                        element.classList.remove('open', 'closed', 'current', 'path-final');
                         // Optionally reset to wall/path if clearing structure
                        if(clearMazeStructure) {
                            if (node.isWall) element.classList.add('wall');
                            else element.classList.remove('wall');
                        }
                    }
                }
            }
        }
        // Ensure start/end are visually correct after clearing
        if (startNode) startNode.getElement()?.classList.add('start');
        if (endNode) endNode.getElement()?.classList.add('end');
    }

    function disableControls(disabled) {
        generateBtn.disabled = disabled;
        solveBtn.disabled = disabled;
        gridSizeInput.disabled = disabled;
        speedInput.disabled = disabled;
    }

    function sleep(ms) {
        return new Promise(resolve => animationFrameId = setTimeout(resolve, ms));
    }

    // --- Event Listeners ---
    generateBtn.addEventListener('click', generateMaze);
    solveBtn.addEventListener('click', solveMaze);

    // --- Initial Setup ---
    generateMaze(); // Generate a maze on load
});