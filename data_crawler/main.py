import platform
import psutil
import tkinter as tk
from tkinter import simpledialog
import csv
import subprocess
import os
import json
import sys


CONFIG_FILE = "config.json"


def get_system_info():
    # Marca e modelo
    try:
        manufacturer = subprocess.check_output(
            "wmic computersystem get manufacturer", shell=True
        ).decode().split("\n")[1].strip()
        model = subprocess.check_output(
            "wmic computersystem get model", shell=True
        ).decode().split("\n")[1].strip()
    except Exception:
        manufacturer, model = "Desconhecido", ""

    # Tipo de equipamento
    try:
        chassis = subprocess.check_output(
            "wmic systemenclosure get chassistypes", shell=True
        ).decode().split("\n")[1].strip()
        if chassis in ["8", "9", "10", "14"]:
            device_type = "Notebook"
        else:
            device_type = "Computador"
    except Exception:
        device_type = "Computador"

    # Processador
    try:
        cpu = subprocess.check_output(
            "wmic cpu get name", shell=True
        ).decode().split("\n")[1].strip()
    except Exception:
        cpu = platform.processor()

    # Memória RAM
    ram_gb = round(psutil.virtual_memory().total / (1024**3))

    # Disco
    try:
        disk_usage = psutil.disk_usage("C:\\")
        disk_size_gb = round(disk_usage.total / (1024**3))
        try:
            media_type = subprocess.check_output(
                "powershell Get-PhysicalDisk | Select MediaType", shell=True
            ).decode()
            if "SSD" in media_type:
                disk_type = "SSD"
            else:
                disk_type = "HDD"
        except Exception:
            disk_type = "Disco"
    except Exception:
        disk_size_gb, disk_type = 0, "Desconhecido"

    descricao = f"{device_type} {manufacturer} {model} {cpu}, {ram_gb}GB RAM, {disk_size_gb}GB {disk_type}"
    return descricao.strip()


def get_csv_filename():
    """
    Retorna o nome do arquivo CSV a ser usado.
    Se não existir config.json ou o arquivo não existir, pede ao usuário.
    """
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
            csv_file = config.get("csv_file")

            if csv_file and os.path.exists(csv_file):
                return csv_file

    # Se chegou aqui, não há arquivo CSV válido → perguntar ao usuário
    root = tk.Tk()
    root.withdraw()
    filename = simpledialog.askstring("Nome do Arquivo", "Digite o nome do arquivo CSV (sem .csv):")
    if not filename:
        filename = "data"

    csv_file = f"{filename}.csv"

    # Cria o CSV com headers
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";", lineterminator="\n" )
        writer.writerow(["identificador", "descricao", "localizacao"])

    # Salva no config.json
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"csv_file": csv_file}, f)

    return csv_file


def main():
    descricao = get_system_info()

    root = tk.Tk()
    root.withdraw()

    local = simpledialog.askstring("Local do Computador", "Digite o local do computador:")
    if not local or local.strip() == "":
        # janela de erro como filho do root
        erro = tk.Toplevel(root)
        erro.title("Erro de localização")

        label = tk.Label(erro, text="INFORME UMA LOCALIZAÇÃO!", font=("Segoe UI", 14))
        label.pack(padx=20, pady=20)

        # se clicar no X → destruir root e sair
        erro.protocol("WM_DELETE_WINDOW", lambda: (root.destroy(), sys.exit()))

        # botão para fechar e sair
        btn = tk.Button(erro, text="Fechar", command=lambda: (root.destroy(), sys.exit()))
        btn.pack(pady=10)

        root.mainloop()
        return

    patrimonio = simpledialog.askstring("Patrimônio", "Digite o número de patrimônio (ou deixe vazio):")
    if not patrimonio or patrimonio.strip() == "":
        nome = "Sem identificador de patrimônio"
    else:
        nome = patrimonio.strip()

    csv_file = get_csv_filename()

    with open(csv_file, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";", lineterminator="\n")
        writer.writerow([patrimonio, descricao, local])

    print(f"Informações salvas em {csv_file}")


if __name__ == "__main__":
    main()