#!/bin/bash -e
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <disable|enable>"
    exit 1
fi

case $1 in
    disable)
        for i in {1..7}
        do
            echo 0 > /sys/devices/system/cpu/cpu$i/online
        done
        ;;
    enable)
        for i in {1..7}
        do
            echo 1 > /sys/devices/system/cpu/cpu$i/online
        done
        ;;
    *)
        echo "Invalid argument: $1"
        echo "Usage: $0 <disable|enable>"
        exit 2
        ;;
esac
