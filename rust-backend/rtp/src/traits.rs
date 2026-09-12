//! Traits for reading and writing packets

use crate::Error;

/// Trait for reading packets from a byte stream
pub trait ReadPacket<T> {
    /// Read a packet from the given byte slice
    fn read_packet(&self, buf: &mut &[u8]) -> crate::Result<T>;
}

/// Trait for writing packets to a byte stream
pub trait WritePacket<T> {
    /// Write a packet to the given byte vector
    fn write_packet(&self, buf: &mut Vec<u8>, packet: &T) -> crate::Result<()>;
}
