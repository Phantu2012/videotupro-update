Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir
WshShell.Run "cmd /c py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8765", 0, False
WScript.Sleep 2000
WshShell.Run "http://127.0.0.1:8765", 1, False
