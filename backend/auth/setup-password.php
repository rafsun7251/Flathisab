
<?php

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/app.php";

$message = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $setupKey = $_POST["setup_key"] ?? "";
    $username = trim($_POST["username"] ?? "");
    $password = $_POST["password"] ?? "";
    $confirmPassword = $_POST["confirm_password"] ?? "";

    if (!hash_equals(INITIAL_SETUP_KEY, $setupKey)) {
        $message = "Invalid setup key.";

    } elseif ($username === "") {
        $message = "Username is required.";

    } elseif (strlen($password) < 3) {
        $message = "Password must be at least 3 characters.";

    } elseif ($password !== $confirmPassword) {
        $message = "Passwords do not match.";

    } else {

        try {
            $database = new Database();
            $db = $database->connect();

            $hash = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $db->prepare("
                UPDATE users
                SET password_hash = :password_hash,
                    account_status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE username = :username
                  AND account_status = 'NEEDS_PASSWORD_SETUP'
                  AND password_hash IS NULL
            ");

            $stmt->execute([
                ":password_hash" => $hash,
                ":username" => $username
            ]);

            if ($stmt->rowCount() === 1) {
                $message = "Password successfully created for " . htmlspecialchars($username);
            } else {
                $message = "User not found or password already configured.";
            }

        } catch (Throwable $e) {
            error_log($e->getMessage());
            $message = "Unable to complete password setup.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FlatHisab - Password Setup</title>
</head>
<body>

    <h2>FlatHisab Initial Password Setup</h2>

    <p>
        <?= htmlspecialchars($message) ?>
    </p>

    <form method="POST">

        <label>Setup Secret Key</label><br>
        <input type="password" name="setup_key" required>
        <br><br>

        <label>Username</label><br>
        <input type="text" name="username" required>
        <br><br>

        <label>New Password</label><br>
        <input type="password" name="password" minlength="3" required>
        <br><br>

        <label>Confirm Password</label><br>
        <input type="password" name="confirm_password" minlength="3" required>
        <br><br>

        <button type="submit">Set Password</button>

    </form>

</body>
</html>
