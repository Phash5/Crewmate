// --- Game Settings ---
const PLAYER_SPEED = 3;
const NUM_PLAYERS = 6;
const NUM_IMPOSTORS = 1; // Keep it simple for now
const KILL_COOLDOWN = 10 * 60; // 10 seconds (frames)
const TASK_LOCATIONS = [
    { x: 100, y: 100, name: "Wires", completed: false },
    { x: 500, y: 400, name: "Engine", completed: false },
    { x: 150, y: 500, name: "Shields", completed: false },
    { x: 650, y: 150, name: "Comms", completed: false }
];
const EMERGENCY_BUTTON = { x: 400, y: 300, radius: 25, cooldown: 30 * 60, lastUsed: -Infinity };
const INTERACTION_DISTANCE = 50; // How close to interact

// --- Game State ---
let gameState = 'GAMEPLAY'; // GAMEPLAY, MEETING, VOTING, EJECTED, GAMEOVER
let players = [];
let controlledPlayerIndex = 0; // You control player 0
let bodies = []; // { x, y, color }
let meetingCaller = null; // Who called the meeting ('body', 'emergency', or player index)
let votes = {}; // { voterIndex: votedPlayerIndex }
let ejectedPlayerIndex = -1;
let winner = null; // 'Crewmates' or 'Impostors'
let tasksCompleted = 0;
let totalTasks = TASK_LOCATIONS.length; // Simplified: one task per location for crew

// --- P5.js Functions ---

function setup() {
    createCanvas(800, 600);
    initializeGame();
}

function draw() {
    background(50, 50, 70); // Dark spacey background

    // Update and Draw based on Game State
    switch (gameState) {
        case 'GAMEPLAY':
            handleGameplay();
            break;
        case 'MEETING':
            handleMeeting();
            break;
        case 'VOTING':
            handleVoting();
            break;
        case 'EJECTED':
            handleEjected();
            break;
        case 'GAMEOVER':
            handleGameOver();
            break;
    }

     // Always draw basic UI
     drawUI();
}

function keyPressed() {
    if (gameState === 'GAMEPLAY') {
        const p = players[controlledPlayerIndex];
        if (!p.isAlive) return;

        // --- Interactions ---
        // Use / Task (E key)
        if (key === 'e' || key === 'E') {
            if (!p.isImpostor) {
                tryToDoTask(p);
            }
        }

        // Kill (Q key) - Impostor Only
        if ((key === 'q' || key === 'Q') && p.isImpostor && p.killTimer <= 0) {
            tryToKill(p);
        }

        // Report (R key)
        if (key === 'r' || key === 'R') {
            tryToReportBody(p);
        }

        // Emergency Meeting (Spacebar)
        if (key === ' ') {
             tryCallEmergency(p);
        }
    }
}

function mousePressed() {
    if (gameState === 'VOTING') {
        castVote(mouseX, mouseY);
    }
}


// --- Game Logic Functions ---

function initializeGame() {
    players = [];
    bodies = [];
    votes = {};
    ejectedPlayerIndex = -1;
    winner = null;
    tasksCompleted = 0;
    gameState = 'GAMEPLAY';
    EMERGENCY_BUTTON.lastUsed = -frameCount; // Reset cooldown

    // Reset tasks
    TASK_LOCATIONS.forEach(task => task.completed = false);

    // Create Players
    let impostorIndices = [];
    while (impostorIndices.length < NUM_IMPOSTORS) {
        let r = floor(random(NUM_PLAYERS));
        if (!impostorIndices.includes(r)) {
            impostorIndices.push(r);
        }
    }

    for (let i = 0; i < NUM_PLAYERS; i++) {
        players.push({
            id: i,
            x: random(50, width - 50),
            y: random(50, height - 50),
            color: color(random(100, 255), random(100, 255), random(100, 255)),
            isImpostor: impostorIndices.includes(i),
            isAlive: true,
            tasksDone: 0, // Only relevant for crew
            killTimer: 0 // Only relevant for impostor
        });
    }
    console.log("You are Player 0.");
    console.log(players[0].isImpostor ? "You are an Impostor!" : "You are a Crewmate.");
}

function handleGameplay() {
    moveControlledPlayer();
    updateImpostorCooldown();
    checkWinConditions(); // Check wins during gameplay too

    // Draw elements
    drawTasks();
    drawBodies();
    drawEmergencyButton();
    drawPlayers();
}

function moveControlledPlayer() {
    const p = players[controlledPlayerIndex];
    if (!p.isAlive) return;

    let dx = 0;
    let dy = 0;
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) dx -= PLAYER_SPEED; // A
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) dx += PLAYER_SPEED; // D
    if (keyIsDown(UP_ARROW) || keyIsDown(87)) dy -= PLAYER_SPEED; // W
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) dy += PLAYER_SPEED; // S

    p.x = constrain(p.x + dx, 20, width - 20); // Keep player on screen
    p.y = constrain(p.y + dy, 20, height - 20);
}

function updateImpostorCooldown() {
    players.forEach(p => {
        if (p.isImpostor && p.killTimer > 0) {
            p.killTimer--;
        }
    });
}

function tryToDoTask(player) {
    for (let task of TASK_LOCATIONS) {
        if (!task.completed && dist(player.x, player.y, task.x, task.y) < INTERACTION_DISTANCE) {
            console.log(`Completed task: ${task.name}`);
            task.completed = true;
            tasksCompleted++;
            // In a real game, player.tasksDone would increase.
            // Here we track global tasks.
            checkWinConditions();
            return; // Only do one task at a time
        }
    }
    console.log("No task nearby.");
}

function tryToKill(impostor) {
    for (let i = 0; i < players.length; i++) {
        if (i === controlledPlayerIndex) continue; // Can't kill self
        const target = players[i];
        if (target.isAlive && !target.isImpostor && dist(impostor.x, impostor.y, target.x, target.y) < INTERACTION_DISTANCE) {
            console.log(`Player ${controlledPlayerIndex} killed Player ${i}`);
            target.isAlive = false;
            bodies.push({ x: target.x, y: target.y, color: target.color, reported: false });
            impostor.killTimer = KILL_COOLDOWN;
            checkWinConditions();
            return; // Only kill one at a time
        }
    }
    console.log("No target in range or kill on cooldown.");
}

function tryToReportBody(reporter) {
     for (let body of bodies) {
         if (!body.reported && dist(reporter.x, reporter.y, body.x, body.y) < INTERACTION_DISTANCE) {
             console.log(`Player ${reporter.id} reported a body!`);
             body.reported = true; // Mark as reported so it cant trigger again immediately
             startMeeting('body', reporter.id);
             return;
         }
     }
     console.log("No body nearby to report.");
}

function tryCallEmergency(player) {
    let timeSinceLastUse = frameCount - EMERGENCY_BUTTON.lastUsed;
     if (dist(player.x, player.y, EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y) < EMERGENCY_BUTTON.radius + 10) {
         if(timeSinceLastUse > EMERGENCY_BUTTON.cooldown) {
            console.log(`Player ${player.id} called an Emergency Meeting!`);
            EMERGENCY_BUTTON.lastUsed = frameCount;
            startMeeting('emergency', player.id);
         } else {
             console.log(`Emergency Button on cooldown (${ceil((EMERGENCY_BUTTON.cooldown - timeSinceLastUse)/60)}s left)`);
         }
     } else {
         console.log("Not close enough to the Emergency Button.");
     }
}


function startMeeting(reason, callerId) {
    gameState = 'MEETING';
    meetingCaller = { reason, callerId };
    votes = {}; // Reset votes for the new meeting
    // Simple: Teleport everyone to center for meeting view
    players.forEach((p, i) => {
        p.x = width / 2 + (i - NUM_PLAYERS / 2) * 60;
        p.y = height / 2;
    });
     console.log("--- MEETING STARTED ---");
     console.log(reason === 'body' ? `A body was reported by Player ${callerId}` : `Emergency meeting called by Player ${callerId}`);
     console.log("Discuss!");
     // Automatically transition to voting after a short delay
     setTimeout(() => {
         if (gameState === 'MEETING') { // Ensure we haven't changed state elsewhere
             gameState = 'VOTING';
             console.log("--- VOTING STARTED ---");
             console.log("Click on a player to vote. You are Player 0.");
         }
     }, 3000); // 3 second discussion time
}

function handleMeeting() {
    // Just display text and players visually
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("MEETING IN PROGRESS", width / 2, 50);
    let reasonText = meetingCaller.reason === 'body' ? `Body reported by Player ${meetingCaller.callerId}` : `Emergency Meeting by Player ${meetingCaller.callerId}`;
    text(reasonText, width / 2, 90);
    drawPlayers(); // Show players grouped together
}

function handleVoting() {
    fill(255);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("VOTE WHO TO EJECT", width / 2, 50);
    textSize(16);
    text("Click on a player. Alive players only.", width / 2, 80);

    drawPlayers(); // Show players grouped for voting

    // Show who has voted (simple)
    textSize(12);
    textAlign(LEFT, TOP);
    fill(200);
    let voterList = "Votes Cast: ";
    for(const voterId in votes) {
        voterList += `P${voterId}, `;
    }
    text(voterList, 10, height - 20);


    // Check if everyone alive has voted (simple simulation - just check controlled player)
    // In a real game, you'd wait for all players. Here, we proceed once the controlled player votes.
    if (votes[controlledPlayerIndex] !== undefined) {
         // Add dummy votes for others for simulation
         players.forEach((p, i) => {
            if (i !== controlledPlayerIndex && p.isAlive && votes[i] === undefined) {
                // AI votes randomly (excluding self) - very basic
                let potentialVotes = players.filter((target, targetIdx) => target.isAlive && targetIdx !== i).map(p => p.id);
                if (potentialVotes.length > 0) {
                     votes[i] = random(potentialVotes);
                } else {
                    votes[i] = -1; // Skip vote if no one else is alive
                }
            }
         });
        processVotes();
    }
}

function castVote(mx, my) {
    if (votes[controlledPlayerIndex] !== undefined) return; // Already voted

    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.isAlive && dist(mx, my, p.x, p.y) < 20) { // Check click on player circle
            console.log(`Player 0 voted for Player ${i}`);
            votes[controlledPlayerIndex] = i;
            return;
        }
    }
    // Option to skip vote
    // Add a skip button area check if needed
}

function processVotes() {
    console.log("--- Processing Votes ---");
    let voteCounts = {};
    let maxVotes = 0;
    let tied = false;
    ejectedPlayerIndex = -1; // Default to no one ejected (skip/tie)

    players.forEach(p => {
        if (p.isAlive) {
            voteCounts[p.id] = 0; // Initialize count for all alive players
        }
    });

    // Count votes from the 'votes' object
    for (const voterId in votes) {
        const votedForId = votes[voterId];
         if (votedForId !== -1 && voteCounts[votedForId] !== undefined) { // Check if voted player exists and is alive
            voteCounts[votedForId]++;
         }
    }
    console.log("Vote Counts:", voteCounts);


    // Find the player(s) with the most votes
    let mostVotedPlayers = [];
    for (const playerId in voteCounts) {
        if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            mostVotedPlayers = [parseInt(playerId)];
            tied = false;
        } else if (voteCounts[playerId] === maxVotes && maxVotes > 0) {
             mostVotedPlayers.push(parseInt(playerId));
            tied = true;
        }
    }

    if (!tied && mostVotedPlayers.length === 1 && maxVotes > 0) {
         ejectedPlayerIndex = mostVotedPlayers[0];
        players[ejectedPlayerIndex].isAlive = false;
        console.log(`Player ${ejectedPlayerIndex} received ${maxVotes} votes and is ejected.`);
    } else {
        console.log(tied ? "Vote tied!" : "No majority or skip. No one ejected.");
        ejectedPlayerIndex = -1; // Ensure it's -1 for tie/skip
    }

    gameState = 'EJECTED';

    // Pause briefly to show result
    setTimeout(() => {
         if (gameState === 'EJECTED') { // Check state hasn't changed
            checkWinConditions();
            if (winner === null) {
                // Return to gameplay if game not over
                gameState = 'GAMEPLAY';
                // Reset player positions slightly randomized
                players.forEach(p => {
                     if(p.isAlive) {
                         p.x = random(50, width - 50);
                         p.y = random(50, height - 50);
                     }
                 });
                 bodies = bodies.filter(b => !b.reported); // Remove reported bodies
            } else {
                gameState = 'GAMEOVER'; // Go to game over screen
            }
         }
    }, 4000); // 4 second pause for ejection result
}


function handleEjected() {
    background(0); // Black screen for drama
    fill(255);
    textSize(32);
    textAlign(CENTER, CENTER);

    if (ejectedPlayerIndex !== -1) {
        const ejectedPlayer = players[ejectedPlayerIndex];
        text(`Player ${ejectedPlayerIndex} was Ejected.`, width / 2, height / 2 - 40);
        textSize(24);
        fill(ejectedPlayer.isImpostor ? color(255, 0, 0) : color(0, 255, 0));
        text(ejectedPlayer.isImpostor ? 'Was an Impostor' : 'Was not an Impostor', width / 2, height / 2 + 20);
    } else {
        text("No one was ejected (Vote Tied or Skipped).", width / 2, height / 2);
    }
}

function handleGameOver() {
     background(0);
     fill(255);
     textSize(48);
     textAlign(CENTER, CENTER);
     if (winner === 'Crewmates') {
         fill(0, 255, 0);
         text("Crewmates Win!", width / 2, height / 2 - 30);
     } else {
         fill(255, 0, 0);
         text("Impostors Win!", width / 2, height / 2 - 30);
     }
     textSize(20);
     fill(255);
     text("Press R to Restart", width / 2, height / 2 + 40);

     // Allow restarting
     if (keyIsPressed && (key === 'r' || key === 'R')) {
         initializeGame();
     }
}

function checkWinConditions() {
    if (winner) return; // Game already won

    let aliveCrewmates = 0;
    let aliveImpostors = 0;
    players.forEach(p => {
        if (p.isAlive) {
            if (p.isImpostor) {
                aliveImpostors++;
            } else {
                aliveCrewmates++;
            }
        }
    });

    // Impostor Win Conditions:
    // 1. Number of impostors >= number of crewmates
    if (aliveImpostors >= aliveCrewmates && aliveCrewmates > 0) { // Need at least one crewmate to compare against
        console.log("Impostors Win - Equal or greater numbers");
        winner = 'Impostors';
        gameState = 'GAMEOVER';
        return;
    }
     // 2. Crewmates are all dead
     if (aliveCrewmates <= 0 && aliveImpostors > 0) {
        console.log("Impostors Win - No Crewmates Left");
        winner = 'Impostors';
        gameState = 'GAMEOVER';
        return;
    }

    // Crewmate Win Conditions:
    // 1. All impostors are ejected/killed
    if (aliveImpostors <= 0) {
        console.log("Crewmates Win - All Impostors eliminated");
        winner = 'Crewmates';
        gameState = 'GAMEOVER';
        return;
    }
    // 2. All tasks are completed
    if (tasksCompleted >= totalTasks) {
        console.log("Crewmates Win - All tasks completed");
        winner = 'Crewmates';
        gameState = 'GAMEOVER';
        return;
    }
}


// --- Drawing Functions ---

function drawPlayers() {
    players.forEach((p, i) => {
        if (p.isAlive) {
            fill(p.color);
            stroke(0);
            strokeWeight(2);
            ellipse(p.x, p.y, 40, 40); // Player circle

            // Indicate controlled player
            if (i === controlledPlayerIndex) {
                noFill();
                stroke(255, 255, 0); // Yellow outline
                ellipse(p.x, p.y, 45, 45);
            }
             // Indicate Impostor (only visible to self in this prototype)
            if (i === controlledPlayerIndex && p.isImpostor) {
                fill(255,0,0);
                textSize(10);
                textAlign(CENTER, CENTER);
                noStroke();
                text("IMPOSTOR", p.x, p.y + 25);
            }
             // Player ID Text (useful for voting/debugging)
             fill(255);
             textSize(12);
             textAlign(CENTER, CENTER);
             noStroke();
             text(p.id, p.x, p.y);

        } else {
             // Draw 'ghost' or just nothing for dead players in gameplay
             if (gameState !== 'GAMEPLAY') {
                  // Show dead players crossed out during meeting/voting
                fill(100); // Grayed out
                stroke(0);
                strokeWeight(2);
                ellipse(p.x, p.y, 40, 40);
                stroke(255, 0, 0); // Red X
                line(p.x - 15, p.y - 15, p.x + 15, p.y + 15);
                line(p.x + 15, p.y - 15, p.x - 15, p.y + 15);
                fill(200);
                textSize(12);
                textAlign(CENTER, CENTER);
                noStroke();
                text(p.id, p.x, p.y);
             }
        }
    });
}

function drawTasks() {
    TASK_LOCATIONS.forEach(task => {
        stroke(255);
        strokeWeight(1);
        if (task.completed) {
            fill(0, 150, 0, 150); // Greenish tint when done
        } else {
             fill(255, 255, 0, 150); // Yellowish tint for available
        }
        rectMode(CENTER);
        rect(task.x, task.y, 30, 30);

        // Highlight if player is near
        const p = players[controlledPlayerIndex];
        if (!p.isImpostor && !task.completed && p.isAlive && dist(p.x, p.y, task.x, task.y) < INTERACTION_DISTANCE) {
            noFill();
            stroke(255);
            strokeWeight(2);
            ellipse(task.x, task.y, 40, 40);
        }
    });
    rectMode(CORNER); // Reset rect mode
}

function drawBodies() {
    bodies.forEach(body => {
         if (!body.reported) {
            fill(body.color);
            stroke(255, 0, 0); // Red outline for bodies
            strokeWeight(3);
            ellipse(body.x, body.y, 35, 35); // Slightly smaller
            // Draw 'X' or bones maybe
            stroke(0);
            line(body.x-10, body.y-10, body.x+10, body.y+10);
            line(body.x+10, body.y-10, body.x-10, body.y+10);

            // Highlight if player is near
             const p = players[controlledPlayerIndex];
             if (p.isAlive && dist(p.x, p.y, body.x, body.y) < INTERACTION_DISTANCE) {
                 noFill();
                 stroke(255, 0, 0);
                 strokeWeight(2);
                 ellipse(body.x, body.y, 45, 45);
             }
         }
    });
}

function drawEmergencyButton() {
    fill(200, 0, 0);
    stroke(255);
    strokeWeight(2);
    ellipse(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, EMERGENCY_BUTTON.radius * 2, EMERGENCY_BUTTON.radius * 2);
     fill(255);
     noStroke();
     textAlign(CENTER, CENTER);
     textSize(10);
     text("EMERG", EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y);

     // Highlight if player is near
     const p = players[controlledPlayerIndex];
     let timeSinceLastUse = frameCount - EMERGENCY_BUTTON.lastUsed;
     let onCooldown = timeSinceLastUse <= EMERGENCY_BUTTON.cooldown;

     if (p.isAlive && dist(p.x, p.y, EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y) < EMERGENCY_BUTTON.radius + 10) {
         noFill();
         stroke(onCooldown ? 150: 255); // Dimmer stroke if on cooldown
         strokeWeight(2);
         ellipse(EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y, EMERGENCY_BUTTON.radius * 2 + 10, EMERGENCY_BUTTON.radius * 2 + 10);
     }

     // Draw cooldown timer text if active
     if (onCooldown && gameState === 'GAMEPLAY') {
         fill(255);
         textSize(12);
         text(ceil((EMERGENCY_BUTTON.cooldown - timeSinceLastUse)/60), EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.radius + 10);
     }
}


function drawUI() {
    // General Info Text (Top Left)
    fill(255);
    textSize(14);
    textAlign(LEFT, TOP);
    noStroke();
    let roleText = players[controlledPlayerIndex].isImpostor ? "Role: Impostor" : "Role: Crewmate";
    text(roleText, 10, 10);
    text(`State: ${gameState}`, 10, 30);
    if (gameState === 'GAMEPLAY') {
        text(`Tasks: ${tasksCompleted} / ${totalTasks}`, 10, 50);
    }

    // Interaction Prompts (Bottom Center) - Contextual
    const p = players[controlledPlayerIndex];
    if (gameState === 'GAMEPLAY' && p.isAlive) {
        let promptText = "";
        // Task Prompt
        if (!p.isImpostor) {
            for (let task of TASK_LOCATIONS) {
                if (!task.completed && dist(p.x, p.y, task.x, task.y) < INTERACTION_DISTANCE) {
                    promptText = "[E] Use Task";
                    break;
                }
            }
        }
        // Kill Prompt
        if (p.isImpostor) {
            let killTargetNear = false;
             for (let i = 0; i < players.length; i++) {
                 if (i !== controlledPlayerIndex && players[i].isAlive && !players[i].isImpostor && dist(p.x, p.y, players[i].x, players[i].y) < INTERACTION_DISTANCE) {
                     killTargetNear = true;
                     break;
                 }
            }
            if (killTargetNear && p.killTimer <= 0) {
                 promptText = "[Q] Kill";
            } else if (p.killTimer > 0) {
                // Show Kill Cooldown near player or in UI corner
                 fill(255,0,0,150);
                 textSize(16);
                 textAlign(RIGHT, BOTTOM);
                 text(`Kill CD: ${ceil(p.killTimer / 60)}s`, width - 10, height - 10);
            }
        }
        // Report Prompt
        for (let body of bodies) {
            if (!body.reported && dist(p.x, p.y, body.x, body.y) < INTERACTION_DISTANCE) {
                 promptText = "[R] Report Body";
                 break;
            }
        }
         // Emergency Prompt
         if (dist(p.x, p.y, EMERGENCY_BUTTON.x, EMERGENCY_BUTTON.y) < EMERGENCY_BUTTON.radius + 10) {
             let timeSinceLastUse = frameCount - EMERGENCY_BUTTON.lastUsed;
             if(timeSinceLastUse > EMERGENCY_BUTTON.cooldown) {
                promptText = "[SPACE] Emergency Meeting";
             }
         }


        if (promptText) {
            fill(0, 0, 0, 150); // Semi-transparent black background
            rectMode(CENTER);
            rect(width / 2, height - 30, textWidth(promptText) + 20, 30, 5); // Rounded rectangle
            rectMode(CORNER); // Reset rect mode
            fill(255);
            textSize(18);
            textAlign(CENTER, CENTER);
            text(promptText, width / 2, height - 30);
        }
    }
}
