
<?php

class Database
{
    private $host = "localhost";
    private $port = "3306";
    private $db_name = "flathisab_db";
    private $username = "root";
    private $password = "rafsun";

    public function connect()
    {
        try {

            $connection = new PDO(
                "mysql:host={$this->host};port={$this->port};dbname={$this->db_name};charset=utf8mb4",
                $this->username,
                $this->password
            );

            $connection->setAttribute(
                PDO::ATTR_ERRMODE,
                PDO::ERRMODE_EXCEPTION
            );

            $connection->setAttribute(
                PDO::ATTR_DEFAULT_FETCH_MODE,
                PDO::FETCH_ASSOC
            );

            return $connection;

        } catch (PDOException $e) {

            error_log($e->getMessage());

            throw new RuntimeException(
                "Database connection failed."
            );
        }
    }
}
