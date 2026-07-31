' ==============================================================================
' 👗 GIRL STORE POS - STANDALONE DESKTOP LAUNCHER
' start_pos.vbs - Lancement automatique du Serveur Backend et de l'Interface Web
' ==============================================================================

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' 1. Détermination dynamique du dossier du projet (ScriptPath)
ScriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Dossier explicite de l'utilisateur d'après sa capture d'écran
UserPath = "C:\Users\hi imane\Downloads\pijama-store-pos (3)"

' Sélection intelligente du dossier de travail
If FSO.FileExists(ScriptPath & "\package.json") Then
    WorkingDir = ScriptPath
ElseIf FSO.FolderExists(UserPath) Then
    WorkingDir = UserPath
Else
    ' Fallback si déplacé
    WorkingDir = ScriptPath
End If

' Définir le dossier actif pour l'exécution des commandes
WshShell.CurrentDirectory = WorkingDir

' 2. Lancement silencieux du serveur Node.js (0 = Fenêtre Invisible, False = Ne pas bloquer le script)
' Exécute "npm run dev" en arrière-plan sans afficher de fenêtre d'invite de commandes (CMD black window)
WshShell.Run "cmd /c npm run dev", 0, False

' 3. Temps d'attente pour l'initialisation du serveur (4 secondes)
WScript.Sleep 4000

' 4. Détecter l'emplacement de Google Chrome pour l'ouvrir en mode "App" sans barres d'onglets (Style Excel/Desktop App)
LocalAppUrl = "http://localhost:3000"
ChromeOpened = False

' Chemins d'accès standards pour Google Chrome sous Windows
ChromePaths = Array( _
    "C:\Program Files\Google\Chrome\Application\chrome.exe", _
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", _
    WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\AppData\Local\Google\Chrome\Application\chrome.exe" _
)

' Essayer de lancer Google Chrome en mode standalone ("App Mode")
For Each Path In ChromePaths
    If FSO.FileExists(Path) Then
        ' --app = Mode application (Pas de barre de recherche, pas d'onglets)
        ' --start-maximized = Ouvrir en plein écran
        WshShell.Run """" & Path & """ --app=" & LocalAppUrl & " --start-maximized", 1, False
        ChromeOpened = True
        Exit For
    End If
Next

' 5. Si Google Chrome n'est pas installé, utiliser Microsoft Edge (Disponible par défaut sur tous les Windows 10/11)
If Not ChromeOpened Then
    EdgePaths = Array( _
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", _
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe" _
    )
    
    EdgeOpened = False
    For Each Path In EdgePaths
        If FSO.FileExists(Path) Then
            WshShell.Run """" & Path & """ --app=" & LocalAppUrl & " --start-maximized", 1, False
            EdgeOpened = True
            Exit For
        End If
    Next
    
    ' Si même les chemins directs d'Edge échouent, on lance via la commande système par défaut
    If Not EdgeOpened Then
        WshShell.Run "cmd /c start msedge --app=" & LocalAppUrl & " --start-maximized", 0, False
    End If
End If

' Libération de la mémoire
Set WshShell = Nothing
Set FSO = Nothing
WScript.Quit
