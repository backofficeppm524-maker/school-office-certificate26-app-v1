Dim objShell, strDir, strBat
Set objShell = CreateObject("WScript.Shell")
strDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
strBat = strDir & "Launch_Office_Certificate_App.bat"
objShell.Run """" & strBat & """", 0, False
Set objShell = Nothing
