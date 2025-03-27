document.addEventListener('DOMContentLoaded', () => {
    // --- Existing variables ---
    const mazeContainer = document.getElementById('maze-container');
    const generateBtn = document.getElementById('generate-btn');
    const solveBtn = document.getElementById('solve-btn');
    const gridSizeInput = document.getElementById('gridSize');
    const speedInput = document.getElementById('speed');
    const statusDiv = document.getElementById('status');

    // --- New recording variables ---
    const recordBtn = document.getElementById('record-btn');
    const recordingStatusDiv = document.getElementById('recording-status');
    const canvas = document.getElementById('recording-canvas');
    const ctx = canvas.getContext('2d');
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;
    let mazeSolved = false; // Track if the maze has been solved at least once

    let grid = [];
    let rows, cols;
    let startNode = null;
    let endNode = null;
    let isGenerating = false;
    let isSolving = false;
    let visualizationDelay = 50;
    let animationFrameId = null;

    const CELL_SIZE = 20;

    // --- Visualization Colors ---
    const COLORS = {
        background: '#fff',
        wall: '#333',
        path: '#fff', // Default cell color if not wall
        start: '#28a745',
        end: '#dc3545',
        open: '#add8e6',
        closed: '#b0c4de',
        current: '#ffc107',
        pathFinal: '#ffeb3b',
        gridLine: '#eee' // For canvas grid lines
    };

    // --- Node Class (Unchanged) ---
    class Node {
         constructor(row, col, isWall = false) {
            this.row = row;
            this.col = col;
            this.isWall = isWall;
            this.g = Infinity;
            this.h = 0;
            this.f = Infinity;
            this.parent = null;
            this.isStart = false;
            this.isEnd = false;
            // Add state for drawing on canvas
            this.isCurrent = false;
            this.isOpen = false;
            this.isClosed = false;
            this.isPathFinal = false;
        }

        reset() {
            this.g = Infinity;
            this.h = 0;
            this.f = Infinity;
            this.parent = null;
            this.isCurrent = false;
            this.isOpen = false;
            this.isClosed = false;
            this.isPathFinal = false;
            // isWall, isStart, isEnd remain
        }

        getElement() {
            return document.getElementById(`cell-${this.row}-${this.col}`);
        }

        // Update DOM visual
        updateVisual(className, add = true) {
            const element = this.getElement();
            if (element) {
                // Clear previous A* states if adding a new one (except for path)
                if (add && className !== 'path-final' && !this.isStart && !this.isEnd) {
                   element.classList.remove('open', 'closed', 'current');
                }

                if (add) {
                    if (!(this.isStart || this.isEnd) || className === 'path-final') {
                         element.classList.add(className);
                    }
                    // Override for final path highlight
                    if (className === 'path-final') {
                        element.classList.remove('open', 'closed', 'current');
                        element.classList.add('path-final'); // Ensure final path style is applied
                    }
                } else {
                    element.classList.remove(className);
                }
            }
        }

         // Update internal state used for canvas drawing
        updateState(state, value = true) {
            switch(state) {
                case 'open': this.isOpen = value; if(value) this.isClosed = false; this.isCurrent = false; break;
                case 'closed': this.isClosed = value; if(value) this.isOpen = false; this.isCurrent = false; break;
                case 'current': this.isCurrent = value; if(value) this.isOpen = false; this.isClosed = false; break;
                case 'path-final': this.isPathFinal = value; break;
            }
        }
    }

    // --- Maze Generation (Minor change: enable record button) ---
    function generateMaze() {
        // ... (previous generateMaze code) ...
        if (isGenerating || isSolving) return;
        isGenerating = true;
        statusDiv.textContent = "Generating Maze...";
        disableControls(true);
        clearVisualization();

        rows = parseInt(gridSizeInput.value);
        cols = parseInt(gridSizeInput.value);
        if (rows % 2 === 0) rows++;
        if (cols % 2 === 0) cols++;
        gridSizeInput.value = rows;

        visualizationDelay = parseInt(speedInput.value);

        grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) {
                grid[r][c] = new Node(r, c, true);
            }
        }

        const startR = 1;
        const startC = 1;
        grid[startR][startC].isWall = false;

        const stack = [[startR, startC]];
        while (stack.length > 0) {
            const [r, c] = stack[stack.length - 1];
            const neighbors = [];
            const directions = [[-2, 0], [2, 0], [0, -2], [0, 2]];
            for (const [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc].isWall) {
                    neighbors.push([nr, nc]);
                }
            }
            if (neighbors.length > 0) {
                const [nextR, nextC] = neighbors[Math.floor(Math.random() * neighbors.length)];
                const wallR = r + (nextR - r) / 2;
                const wallC = c + (nextC - c) / 2;
                grid[wallR][wallC].isWall = false;
                grid[nextR][nextC].isWall = false;
                stack.push([nextR, nextC]);
            } else {
                stack.pop();
            }
        }

        startNode = grid[1][1];
        startNode.isStart = true;
        startNode.isWall = false;

        endNode = grid[rows - 2][cols - 2];
        endNode.isEnd = true;
        endNode.isWall = false;

        // Setup canvas dimensions
        canvas.width = cols * CELL_SIZE;
        canvas.height = rows * CELL_SIZE;

        drawGrid(); // Draws the DOM grid
        drawMazeOnCanvas(); // Draws the initial state on the canvas

        statusDiv.textContent = "Maze Generated. Ready to Solve.";
        isGenerating = false;
        disableControls(false);
        solveBtn.disabled = false;
        recordBtn.disabled = true; // Disable record until solved once
        mazeSolved = false;        // Reset solved state
        recordingStatusDiv.textContent = "";
    }

    // --- Drawing the Grid (DOM - Unchanged) ---
    function drawGrid() {
        // ... (previous drawGrid code) ...
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

    // --- NEW: Drawing the Maze State on Canvas ---
    function drawMazeOnCanvas() {
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const node = grid[r][c];
                let color = COLORS.path; // Default

                if (node.isWall) color = COLORS.wall;
                // Order matters for precedence
                if (node.isClosed) color = COLORS.closed;
                if (node.isOpen) color = COLORS.open;
                if (node.isCurrent) color = COLORS.current;
                if (node.isPathFinal) color = COLORS.pathFinal;
                if (node.isStart) color = COLORS.start;
                if (node.isEnd) color = COLORS.end;


                ctx.fillStyle = color;
                ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);

                // Optional: Draw grid lines on canvas (can make video clearer)
                ctx.strokeStyle = COLORS.gridLine;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }


    // --- A* Algorithm (Modified for State Updates) ---
    async function solveMaze(isForRecording = false, stepCallback = null) {
        if ((isSolving || isGenerating || !startNode || !endNode) && !isForRecording) return;

        if (!isForRecording) {
             isSolving = true;
             statusDiv.textContent = "Solving...";
             disableControls(true);
             clearVisualization(false); // Clear previous DOM solve visuals
             visualizationDelay = parseInt(speedInput.value);
        } else {
            // Reset node states for recording run
             grid.flat().forEach(node => node.reset());
        }


        const openSet = [];
        const closedSet = new Set();

        // Reset nodes G/H/F/parent values for solving run
        grid.flat().forEach(node => {
            node.g = Infinity;
            node.h = 0;
            node.f = Infinity;
            node.parent = null;
            // Keep isWall, isStart, isEnd
        });


        startNode.g = 0;
        startNode.h = heuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;
        openSet.push(startNode);
        startNode.updateState('open');
        if (!isForRecording) startNode.updateVisual('open');


        let pathFound = false;

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const currentNode = openSet.shift();

            // Update State
            currentNode.updateState('open', false);
            currentNode.updateState('current', true);


            if (!isForRecording) {
                currentNode.updateVisual('open', false);
                currentNode.updateVisual('current');
                await sleep(visualizationDelay); // VISUALIZATION DELAY
            }
             // Record Step Callback
             if (stepCallback) stepCallback();


            if (currentNode === endNode) {
                pathFound = true;
                await reconstructPath(currentNode, isForRecording, stepCallback);
                if (!isForRecording) {
                    statusDiv.textContent = "Path Found!";
                    mazeSolved = true; // Mark as solved
                }
                break;
            }

            // Update State
             currentNode.updateState('current', false);
             currentNode.updateState('closed', true);
             closedSet.add(currentNode);


            if (!isForRecording) {
                currentNode.updateVisual('current', false);
                currentNode.updateVisual('closed');
            }
             // Record Step Callback (after moving from current to closed)
            if (stepCallback) stepCallback();


            const neighbors = getNeighbors(currentNode);

            for (const neighbor of neighbors) {
                if (neighbor.isWall || closedSet.has(neighbor)) {
                    continue;
                }

                const tentativeG = currentNode.g + 1;

                let newPathFoundInOpenSet = false;
                if (!openSet.includes(neighbor)) {
                    newPathFoundInOpenSet = true;
                    neighbor.h = heuristic(neighbor, endNode);
                    openSet.push(neighbor);
                    neighbor.updateState('open', true); // Update state
                     if (!isForRecording) neighbor.updateVisual('open');
                     // Record Step Callback
                     if (stepCallback) stepCallback();

                } else if (tentativeG >= neighbor.g) {
                    continue; // Not a better path
                }

                // This path is the best until now. Record it!
                neighbor.parent = currentNode;
                neighbor.g = tentativeG;
                neighbor.f = neighbor.g + neighbor.h;

                // If node was already in openSet, sorting handles the update implicitly
            }
             if (!isForRecording && openSet.length > 0) {
                 // Small delay after processing neighbors for visualization flow
                 await sleep(Math.max(1, Math.floor(visualizationDelay / 5)));
             }
        }

        if (!pathFound && !isForRecording) {
            statusDiv.textContent = "No Path Found!";
            mazeSolved = true; // Consider it 'solved' (attempted)
        }


        if (!isForRecording) {
            isSolving = false;
            disableControls(false);
            // Enable recording ONLY if a path was found or attempted
            recordBtn.disabled = !mazeSolved;
        }

        return pathFound; // Return status for recording
    }

    // --- Helper Functions (Heuristic, GetNeighbors - Unchanged) ---
    function heuristic(nodeA, nodeB) {
        return Math.abs(nodeA.row - nodeB.row) + Math.abs(nodeA.col - nodeB.col);
    }

    function getNeighbors(node) {
        // ... (previous getNeighbors code) ...
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

    // --- Reconstruct Path (Modified for State Updates) ---
    async function reconstructPath(endNode, isForRecording = false, stepCallback = null) {
        if (!isForRecording) {
             statusDiv.textContent = "Drawing Path...";
        }

        let currentNode = endNode;
        const path = [];
        while (currentNode !== null) {
            path.push(currentNode);
            currentNode = currentNode.parent;
        }
        path.reverse();

        for (const node of path) {
            node.updateState('path-final', true); // Update state
            if (!node.isStart && !node.isEnd) {
                 if (!isForRecording) {
                    node.updateVisual('path-final');
                    await sleep(visualizationDelay / 2); // VISUALIZATION DELAY
                }
                 // Record Step Callback
                 if (stepCallback) stepCallback();
            } else {
                 // Ensure start/end have path state for canvas, but don't update DOM class
                 node.updateState('path-final', true);
                 if (stepCallback) stepCallback();
            }
        }
    }

     // --- Clear Visualization (Modified to Reset State) ---
    function clearVisualization(clearMazeStructure = true) {
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const node = grid[r]?.[c];
                if (node) {
                    // Reset internal state
                    node.reset();

                    const element = node.getElement();
                    if (element) {
                        // Remove visual classes
                        element.classList.remove('open', 'closed', 'current', 'path-final');
                        if(clearMazeStructure) {
                            if (node.isWall) element.classList.add('wall');
                            else element.classList.remove('wall');
                        }
                    }
                }
            }
        }
        // Reapply start/end visuals if nodes exist
         if (startNode) startNode.getElement()?.classList.add('start');
         if (endNode) endNode.getElement()?.classList.add('end');

         // Also clear canvas if needed (usually done before drawing)
         if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Redraw initial maze state on canvas after clearing
         if (!clearMazeStructure) drawMazeOnCanvas();
    }


    // --- Disable Controls (Modified) ---
    function disableControls(disabled) {
        generateBtn.disabled = disabled;
        solveBtn.disabled = disabled;
        gridSizeInput.disabled = disabled;
        speedInput.disabled = disabled;
        // Disable record button if generating/solving visually, or if maze hasn't been solved yet
        recordBtn.disabled = disabled || !mazeSolved || isRecording;
    }

    // --- Sleep Function (Unchanged) ---
    function sleep(ms) {
        return new Promise(resolve => animationFrameId = setTimeout(resolve, ms));
    }

    // --- NEW: Recording Functions ---

    function startRecording() {
        if (isRecording || isSolving || isGenerating || !mazeSolved) return;

        isRecording = true;
        disableControls(true); // Disable all controls during recording
        recordingStatusDiv.textContent = "Recording starting...";
        recordedChunks = [];

        // --- Setup MediaRecorder ---
        // Try to get MP4, fallback likely WebM
        const options = { mimeType: 'video/mp4; codecs=avc1' }; // H.264 MP4
        let stream;
        try {
             stream = canvas.captureStream(30); // Capture at 30 FPS
             if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} not supported, trying default.`);
                recordingStatusDiv.textContent += " (MP4 not supported, trying WebM)";
                delete options.mimeType; // Use browser default (likely WebM)
            }
             mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
             console.error("Error creating MediaRecorder:", e);
             recordingStatusDiv.textContent = "Error initializing recorder. Check console.";
             isRecording = false;
             disableControls(false);
             return;
        }


        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            recordingStatusDiv.textContent = "Recording finished. Processing...";
            const blob = new Blob(recordedChunks, {
                type: mediaRecorder.mimeType // Use the actual mimeType used
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style.display = 'none';
            a.href = url;
            const fileExtension = mediaRecorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
            a.download = `maze_solve_${rows}x${cols}.${fileExtension}`;
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            recordingStatusDiv.textContent = `Recording saved as ${a.download}`;
            isRecording = false;
            disableControls(false); // Re-enable controls
            recordedChunks = []; // Clear chunks
        };

         mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event.error);
            recordingStatusDiv.textContent = `Recording error: ${event.error.name}. Check console.`;
            isRecording = false;
            disableControls(false);
             recordedChunks = [];
         };

        // --- Run the solver specifically for recording ---
         recordingStatusDiv.textContent = "Recording... Solving maze quickly.";
         mediaRecorder.start();

         // Draw initial state clearly before starting simulation
         clearVisualization(false); // Reset node states visually and internally
         drawMazeOnCanvas();       // Draw initial maze on canvas

         // Callback function to draw canvas on each logical step
         const recordStepCallback = () => {
             drawMazeOnCanvas();
             // Note: We don't need explicit delays here. MediaRecorder captures
             // frames at its own rate (30fps). We just update the canvas state
             // as fast as the algorithm runs.
         };

        // Run the solver logic without delays, using the callback
        solveMaze(true, recordStepCallback)
            .then((found) => {
                 // Ensure the very final state (path fully drawn or no path) is captured
                 drawMazeOnCanvas();
                 // Small delay to ensure the last frame is captured before stopping
                 setTimeout(() => {
                    if (mediaRecorder && mediaRecorder.state === "recording") {
                        mediaRecorder.stop();
                    } else if (mediaRecorder && mediaRecorder.state === "inactive") {
                        // If it stopped prematurely due to error, handle cleanup
                        console.warn("Recorder was inactive when trying to stop.");
                         isRecording = false;
                         disableControls(false);
                         recordedChunks = [];
                    }
                 }, 100); // Wait 100ms
            })
             .catch(error => {
                console.error("Error during recording solve:", error);
                recordingStatusDiv.textContent = "Error during solve for recording.";
                 if (mediaRecorder && mediaRecorder.state === "recording") {
                     mediaRecorder.stop(); // Try to finalize video if possible
                 } else {
                    isRecording = false;
                    disableControls(false);
                    recordedChunks = [];
                 }
            });
    }


    // --- Event Listeners ---
    generateBtn.addEventListener('click', generateMaze);
    solveBtn.addEventListener('click', () => solveMaze()); // Normal solve
    recordBtn.addEventListener('click', startRecording);

    // --- Initial Setup ---
    generateMaze(); // Generate a maze on load
});