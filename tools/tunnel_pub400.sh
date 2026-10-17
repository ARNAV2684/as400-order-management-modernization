#!/bin/sh
# Opens an SSH tunnel so the ODBC driver can reach PUB400's database ports
# Local port numbers MUST match the
# remote ones: the port mapper (449) answers "the database is on 8471", and
# the driver then dials 8471 itself. Tested 2026-10-14: PUB400 allows it.
# Stop it again with:  taskkill /F /IM ssh.exe   (or close the ssh window)
ssh -f -N -o ExitOnForwardFailure=yes \
    -L 449:127.0.0.1:449 \
    -L 8470:127.0.0.1:8470 \
    -L 8471:127.0.0.1:8471 \
    -L 8476:127.0.0.1:8476 \
    pub400 && echo "tunnel UP (449, 8470, 8471, 8476 -> PUB400)"
