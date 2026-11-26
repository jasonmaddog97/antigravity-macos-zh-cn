#!/usr/bin/env python3
"""Minimal zero-dependency Electron ASAR extract & pack tool."""
import json
import os
import struct
import sys


def _read_header(fp):
    _, data_size = struct.unpack("<II", fp.read(8))
    _, json_len = struct.unpack("<II", fp.read(8))
    header_json = fp.read(json_len).decode("utf-8")
    data_offset = 8 + data_size
    return json.loads(header_json), data_offset


def extract(asar_path, dest_dir):
    with open(asar_path, "rb") as fp:
        header, data_offset = _read_header(fp)

        def _walk(node, rel_path):
            if "files" in node:
                os.makedirs(os.path.join(dest_dir, rel_path), exist_ok=True)
                for name, child in node["files"].items():
                    _walk(child, os.path.join(rel_path, name) if rel_path else name)
            else:
                out_path = os.path.join(dest_dir, rel_path)
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                if node.get("unpacked") or "offset" not in node:
                    return
                size = int(node.get("size", 0))
                if size == 0:
                    open(out_path, "wb").close()
                    return
                offset = int(node["offset"])
                fp.seek(data_offset + offset)
                with open(out_path, "wb") as out_f:
                    out_f.write(fp.read(size))

        _walk(header, "")


def pack(src_dir, asar_path):
    files_data = []
    current_offset = 0

    def _build(dir_path):
        nonlocal current_offset
        tree = {"files": {}}
        for name in sorted(os.listdir(dir_path)):
            full_path = os.path.join(dir_path, name)
            if os.path.isdir(full_path):
                tree["files"][name] = _build(full_path)
            elif os.path.isfile(full_path):
                size = os.path.getsize(full_path)
                tree["files"][name] = {
                    "size": size,
                    "offset": str(current_offset),
                }
                files_data.append(full_path)
                current_offset += size
        return tree

    header = _build(src_dir)
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    str_len = len(header_bytes)
    pad = (4 - (str_len % 4)) % 4
    header_pickle_size = 4 + str_len + pad
    data_size = header_pickle_size + 4

    with open(asar_path, "wb") as out_f:
        out_f.write(struct.pack("<II", 4, data_size))
        out_f.write(struct.pack("<II", header_pickle_size, str_len))
        out_f.write(header_bytes)
        out_f.write(b"\x00" * pad)
        for fpath in files_data:
            with open(fpath, "rb") as in_f:
                out_f.write(in_f.read())


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("extract", "pack"):
        print("Usage: asar_tool.py <extract|pack> <src> <dst>")
        sys.exit(1)
    if sys.argv[1] == "extract":
        extract(sys.argv[2], sys.argv[3])
    else:
        pack(sys.argv[2], sys.argv[3])
