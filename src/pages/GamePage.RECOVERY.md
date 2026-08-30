Full GamePage.tsx recovery needed from commit f96cee0bf89ed240f5dd7ba492d59fbb264e014f + Phase 2 live wiring.

Local artifact: /home/workdir/artifacts/GamePage.tsx (954 lines, includes LiveStatusBar).

Diff from f96cee0:
1. Import LiveStatusBar + useLiveGame
2. liveEnabled when status in_progress|completed and marker present
3. LiveStatusBar UI when !isWaiting && myMarker
