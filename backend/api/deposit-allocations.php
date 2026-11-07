
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

function allocationResponse($status, $message, $code = 200, $data = null)
{
    http_response_code($code);

    $response = [
        "status" => $status,
        "message" => $message
    ];

    if ($data !== null) {
        $response["data"] = $data;
    }

    echo json_encode($response);
    exit;
}

function allocationInput()
{
    $data = json_decode(file_get_contents("php://input"), true);
    return is_array($data) ? $data : [];
}

// Authentication
if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    allocationResponse("error", "Authentication required.", 401);
}

$userId = (int) $_SESSION["user_id"];
$isAdmin = strtoupper($_SESSION["role"]) === "ADMIN";

if (!$isAdmin) {
    allocationResponse("error", "Admin access required.", 403);
}

try {

    $database = new Database();
    $db = $database->connect();

    $method = $_SERVER["REQUEST_METHOD"];

    // =========================================
    // GET: View Deposit Allocations
    // =========================================

    if ($method === "GET") {

        $depositId = (int) ($_GET["deposit_id"] ?? 0);

        if ($depositId <= 0) {
            allocationResponse("error", "Valid deposit ID required.", 400);
        }

        $depositStmt = $db->prepare("
            SELECT
                deposit_id,
                member_id,
                deposit_date,
                amount,
                deposit_type,
                status
            FROM deposits
            WHERE deposit_id = :deposit_id
            LIMIT 1
        ");

        $depositStmt->execute([
            ":deposit_id" => $depositId
        ]);

        $deposit = $depositStmt->fetch();

        if (!$deposit) {
            allocationResponse("error", "Deposit not found.", 404);
        }

        $stmt = $db->prepare("
            SELECT
                allocation_id,
                deposit_id,
                allocation_type,
                amount,
                allocated_by,
                allocated_at,
                note
            FROM deposit_allocations
            WHERE deposit_id = :deposit_id
            ORDER BY allocation_id ASC
        ");

        $stmt->execute([
            ":deposit_id" => $depositId
        ]);

        $allocations = $stmt->fetchAll();

        $allocatedTotal = 0;

        foreach ($allocations as $allocation) {
            $allocatedTotal += (float) $allocation["amount"];
        }

        allocationResponse(
            "success",
            "Deposit allocations retrieved successfully.",
            200,
            [
                "deposit" => $deposit,
                "allocations" => $allocations,
                "allocated_total" => round($allocatedTotal, 2),
                "unallocated_amount" => round(
                    (float) $deposit["amount"] - $allocatedTotal,
                    2
                )
            ]
        );
    }

    // =========================================
    // POST: Admin Allocates Deposit
    // =========================================

    if ($method === "POST") {

        $input = allocationInput();

        $depositId = (int) ($input["deposit_id"] ?? 0);

        $mealAmount = $input["meal_amount"] ?? 0;
        $utilityAmount = $input["utility_amount"] ?? 0;

        $note = trim($input["note"] ?? "");

        if ($depositId <= 0) {
            allocationResponse("error", "Invalid deposit ID.", 400);
        }

        foreach ([
            "meal_amount" => $mealAmount,
            "utility_amount" => $utilityAmount
        ] as $field => $value) {

            if (
                !is_numeric($value) ||
                !is_finite((float) $value) ||
                (float) $value < 0 ||
                (float) $value > 9999999999.99 ||
                !preg_match('/^\d+(\.\d{1,2})?$/', (string) $value)
            ) {
                allocationResponse(
                    "error",
                    "Invalid amount for " . $field . ".",
                    400
                );
            }
        }

        if (mb_strlen($note) > 255) {
            allocationResponse("error", "Note is too long.", 400);
        }

        $mealAmount = round((float) $mealAmount, 2);
        $utilityAmount = round((float) $utilityAmount, 2);

        $allocatedTotal = round(
            $mealAmount + $utilityAmount,
            2
        );

        $db->beginTransaction();

        // Lock deposit while allocating
        $depositStmt = $db->prepare("
            SELECT deposit_id, amount, status
            FROM deposits
            WHERE deposit_id = :deposit_id
            FOR UPDATE
        ");

        $depositStmt->execute([
            ":deposit_id" => $depositId
        ]);

        $deposit = $depositStmt->fetch();

        if (!$deposit) {
            $db->rollBack();
            allocationResponse("error", "Deposit not found.", 404);
        }

        if ($deposit["status"] !== "VERIFIED") {
            $db->rollBack();

            allocationResponse(
                "error",
                "Only verified deposits can be allocated.",
                400
            );
        }

        $depositAmount = (float) $deposit["amount"];

        if ($allocatedTotal > $depositAmount) {
            $db->rollBack();

            allocationResponse(
                "error",
                "Allocation total cannot exceed deposit amount.",
                400
            );
        }

        // Replace previous allocation records
        $deleteStmt = $db->prepare("
            DELETE FROM deposit_allocations
            WHERE deposit_id = :deposit_id
        ");

        $deleteStmt->execute([
            ":deposit_id" => $depositId
        ]);

        $insertStmt = $db->prepare("
            INSERT INTO deposit_allocations (
                deposit_id,
                allocation_type,
                amount,
                allocated_by,
                note
            )
            VALUES (
                :deposit_id,
                :allocation_type,
                :amount,
                :allocated_by,
                :note
            )
        ");

        if ($mealAmount > 0) {

            $insertStmt->execute([
                ":deposit_id" => $depositId,
                ":allocation_type" => "MEAL_FUND",
                ":amount" => number_format($mealAmount, 2, ".", ""),
                ":allocated_by" => $userId,
                ":note" => $note !== "" ? $note : null
            ]);
        }

        if ($utilityAmount > 0) {

            $insertStmt->execute([
                ":deposit_id" => $depositId,
                ":allocation_type" => "UTILITY_FUND",
                ":amount" => number_format($utilityAmount, 2, ".", ""),
                ":allocated_by" => $userId,
                ":note" => $note !== "" ? $note : null
            ]);
        }

        $db->commit();

        allocationResponse(
            "success",
            "Deposit allocated successfully.",
            200,
            [
                "deposit_id" => $depositId,
                "deposit_amount" => round($depositAmount, 2),
                "meal_amount" => $mealAmount,
                "utility_amount" => $utilityAmount,
                "allocated_total" => $allocatedTotal,
                "unallocated_amount" => round(
                    $depositAmount - $allocatedTotal,
                    2
                )
            ]
        );
    }

    allocationResponse("error", "Method not allowed.", 405);

} catch (Throwable $e) {

    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }

    error_log($e->getMessage());

    allocationResponse(
        "error",
        "Deposit allocation failed. Check server error log.",
        500
    );
}
