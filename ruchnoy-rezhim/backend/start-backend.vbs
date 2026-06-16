Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\.."
shell.Run "cmd /c """"C:\Program Files\nodejs\node.exe"" backend\api\server.mjs > backend-api.out.log 2> backend-api.err.log""", 0, False
