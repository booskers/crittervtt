@echo off
rem Puts Homebase on your Cloudflare account and builds Critter to use it by default.
cd /d "%~dp0"
node setup.mjs
pause
