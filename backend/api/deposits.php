
<?php

header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/../config/session.php";

function depositResponse($status, $message, $code = 200, $data = null)
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

function getRequestData()
{
    $json = json_decode(file_get_contents("php://input"), true);
    return is_array($json) ? $json : [];
}

function isValidDate($date)
{
    $parsed = DateTime::createFromFormat("!Y-m-d", $date);

    return $parsed && $parsed->format("Y-m-d") === $date;
}

// Authentication
if (!isset($_SESSION["user_id"], $_SESSION["role"])) {
    depositResponse("error", "Authentication required.", 401);
}

$userId = (int) $_SESSION["user_id"];
$role = strtoupper($_SESSION["role"]);
$isAdmin = ($role === "ADMIN");

try {
    $database = new Database();
    $db = $database->connect();

    $method = $_SERVER["REQUEST_METHOD"];

    // =========================================
    // GET: Deposit Records
    // =========================================

    if ($method === "GET") {

        $month = $_GET["month"] ?? date("Y-m");

        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
            depositResponse("error", "Invalid month format.", 400);
        }

        $startDate = $month . "-01";
        $endDate = date(
            "Y-m-d",strtotime($startDate . " +1 month")
        );

        $sql = "
    SELECT
        d.deposit_id,
        d.member_id,
        m.full_name AS member_name,
        d.received_by,
        receiver.full_name AS received_by_name,
        d.deposit_date,
        d.amount,
        d.deposit_type,
        d.payment_method,
        d.reference_note,
        d.status,
        d.created_at
    FROM deposits d
    INNER JOIN users m
        ON m.user_id = d.member_id
    LEFT JOIN users receiver
        ON receiver.user_id = d.received_by
    WHERE d.deposit_date >= :start_date
      AND d.deposit_date < :end_date
            ";

            $params = [
            ":start_date" => $startDate,
            ":end_date" => $endDate
            ];

            if (!$isAdmin) {
             $sql .= " AND d.member_id = :user_id";
             $params[":user_id"] = $userId;
                }

            $sql .= "
            ORDER BY d.deposit_date DESC, d.deposit_id DESC
                    ";

            $stmt = $db->prepare($sql);
            $stmt->execute($params);

        depositResponse(
            "success",
            "Deposit records retrieved successfully.",
            200,
            $stmt->fetchAll()
        );
    }

    // =========================================
    // POST: Submit Deposit
    // =========================================

    if ($method === "POST") {

        $input = getRequestData();

        $memberId = $isAdmin
            ? (int) ($input["member_id"] ?? 0)
            : $userId;

        $receivedBy = null;

        if ($isAdmin && !empty($input["received_by"])) {
            $receivedBy = (int) $input["received_by"];
        }

        $depositDate = trim($input["deposit_date"] ?? "");
        $amount = $input["amount"] ?? null;
        $depositType = strtoupper(trim($input["deposit_type"] ?? ""));
        $paymentMethod = strtoupper(trim($input["payment_method"] ?? ""));
        $referenceNote = trim($input["reference_note"] ?? "");

        if ($memberId <= 0) {
            depositResponse("error", "Select a valid member.", 400);
        }

        if (!isValidDate($depositDate)) {
            depositResponse("error", "Invalid deposit date.", 400);
        }

        if (
            !is_numeric($amount) ||
            !is_finite((float) $amount) ||
            (float) $amount <= 0 ||
            (float) $amount > 9999999999.99
        ) {
            depositResponse("error", "Enter a valid deposit amount.", 400);
        }

        if ($depositType !== "GENERAL_FUND") {
    depositResponse(
        "error",
        "All new deposits must be submitted to General Fund.",
        400
    );
}

        $allowedMethods = [
            "CASH",
            "BANK",
            "BKASH",
            "NAGAD",
            "OTHER"
        ];

        if (!in_array($paymentMethod, $allowedMethods, true)) {
            depositResponse("error", "Invalid payment method.", 400);
        }

        if (mb_strlen($referenceNote) > 255) {
            depositResponse("error", "Reference note is too long.", 400);
        }

        if ($receivedBy !== null && $receivedBy <= 0) {
            depositResponse("error", "Invalid receiver.", 400);
        }

        // Verify member exists
        $memberCheck = $db->prepare("
            SELECT user_id
            FROM users
            WHERE user_id = :member_id
              AND role = 'MEMBER'
              AND account_status = 'ACTIVE'
            LIMIT 1
        ");

        $memberCheck->execute([
            ":member_id" => $memberId
        ]);

        if (!$memberCheck->fetch()) {
            depositResponse("error", "Active member not found.", 404);
        }

        // Verify receiver if provided
        if ($receivedBy !== null) {

            $receiverCheck = $db->prepare("
                SELECT user_id
                FROM users
                WHERE user_id = :receiver_id
                  AND role IN ('ADMIN', 'MEMBER')
                  AND account_status = 'ACTIVE'
                LIMIT 1
            ");

            $receiverCheck->execute([
                ":receiver_id" => $receivedBy
            ]);

            if (!$receiverCheck->fetch()) {
                depositResponse("error", "Receiver not found.", 404);
            }
        }

        $stmt = $db->prepare("
            INSERT INTO deposits (
                member_id,
                received_by,
                deposit_date,
                amount,
                deposit_type,
                payment_method,
                reference_note,
                status
            )
            VALUES (
                :member_id,
                :received_by,
                :deposit_date,
                :amount,
                :deposit_type,
                :payment_method,
                :reference_note,
                'PENDING'
            )
        ");

        $stmt->execute([
            ":member_id" => $memberId,
            ":received_by" => $receivedBy,
            ":deposit_date" => $depositDate,
            ":amount" => number_format((float) $amount, 2, ".", ""),
            ":deposit_type" => $depositType,
            ":payment_method" => $paymentMethod,
            ":reference_note" => $referenceNote !== ""
                ? $referenceNote
                : null
        ]);

        depositResponse(
            "success",
            "Deposit submitted successfully. Waiting for Admin review.",
            201,
            [
                "deposit_id" => (int) $db->lastInsertId(),
                "status" => "PENDING"
            ]
        );
    }

    // =========================================
    // PUT: Admin Review
    // =========================================

    if ($method === "PUT") {

        if (!$isAdmin) {
            depositResponse("error", "Admin access required.", 403);
        }

        $input = getRequestData();

        $depositId = (int) ($input["deposit_id"] ?? 0);
        $status = strtoupper(trim($input["status"] ?? ""));

        if ($depositId <= 0) {
            depositResponse("error", "Invalid deposit ID.", 400);
        }

        if (!in_array($status, ["VERIFIED", "REJECTED"], true)) {
            depositResponse("error", "Invalid review status.", 400);
        }

        $stmt = $db->prepare("
            UPDATE deposits
            SET status = :status
            WHERE deposit_id = :deposit_id
              AND status = 'PENDING'
        ");

        $stmt->execute([
            ":status" => $status,
            ":deposit_id" => $depositId
        ]);

        if ($stmt->rowCount() !== 1) {
            depositResponse(
                "error",
                "Pending deposit not found or already reviewed.",
                404
            );
        }

        depositResponse(
            "success",
            "Deposit review completed.",
            200,
            [
                "deposit_id" => $depositId,
                "status" => $status
            ]
        );
    }

    depositResponse("error", "Method not allowed.", 405);

} catch (Throwable $e) {

    error_log($e->getMessage());

    depositResponse(
        "error",
        "Deposit operation failed. Check the server error log.",
        500
    );
}
