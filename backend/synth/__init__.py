"""HZ-EV Brain synthetic data generator.

This package never reaches a real operator API.  It contains:

- ``operators``       — the 4 operator definitions and their market shares.
- ``geography``       — pile placement around 杭州 future tech city / 钱塘新区.
- ``demand_model``    — time-of-day / region occupancy curves.
- ``failure_inject``  — Poisson fault sampling + communication-loss windows.
- ``generator``       — top-level loop that ties everything together.
"""
