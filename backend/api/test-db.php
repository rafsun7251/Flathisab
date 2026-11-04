
<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../config/database.php";

try {

    $database = new Database();
    $db = $database->connect();

    $stmt = $db->query("SELECT DATABASE() AS db_name");

    $result = $stmt->fetch();

    echo json_encode([
        "status" => "success",
        "message" => "FlatHisab Database Connected!",
        "database" => $result["db_name"]
    ]);

} catch (Throwable $e) {

    http_response_code(500);

    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
