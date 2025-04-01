# Crewmate
How to Run:

Save the HTML code as index.html.

Save the JavaScript code as sketch.js in the same folder.

Open the index.html file in your web browser.

Controls:

W, A, S, D / Arrow Keys: Move your player (Player 0).

E: Complete a task (Crewmate only, when near a yellow square task).

Q: Kill a nearby Crewmate (Impostor only, when cooldown is ready and target is near).

R: Report a body (when near a dead player's marker).

Spacebar: Call an emergency meeting (when near the red button).

Mouse Click: Vote for a player during the VOTING phase.

R (during Game Over): Restart the game.

What this Prototype Demonstrates:

Basic Movement: Controlling a character.

Role Assignment: Player 0 is assigned Crewmate or Impostor.

Task Simulation: Crewmates can interact with task locations to increment a counter.

Kill Mechanic: Impostors can "kill" other players, leaving a body marker. Includes a cooldown.

Reporting: Finding a body triggers a meeting.

Emergency Meetings: Using a button triggers a meeting (with cooldown).

Meeting Flow: Transitions from Gameplay -> Meeting (pause) -> Voting.

Voting Simulation: Click to vote; basic AI votes randomly; determines ejected player based on counts (handles ties/skips).

Ejection: Shows who was ejected and reveals their role.

Win Conditions: Checks for Crewmate task win, Crewmate elimination win, Impostor elimination win, Impostor numerical superiority win.

State Management: Uses gameState to control behavior and drawing.

Basic UI: Shows role, task progress, interaction prompts, cooldowns.

This is a starting point. Building a full game involves adding networking, better AI (for testing/single player), complex map interactions (vents, cameras, logs), diverse tasks, special roles, robust UI, sound, and much more polish.
