@echo off
rem Runs your own Homebase server on port 8787. Players connect the Critter app to http://<this computer's address>:8787,
rem or open that address in a browser to play without installing anything.
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
node server.mjs --port 8787
pause
