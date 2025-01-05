'use client'

import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { createInvitationApi, getOrganizationsApi } from '@/utils/api';
import { Organization } from '@/app/types/Api';
import { toast } from 'react-hot-toast';
import debounce from 'lodash/debounce';

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onClose,
  onInvited
}) => {
  const [email, setEmail] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<Organization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function
  const searchOrganizations = useCallback(
    debounce(async (query: string) => {
      if (!query) {
        setSearchResults([]);
        return;
      }
      
      setIsSearching(true);
      try {
        // Only fetch team and enterprise organizations
        const response = await getOrganizationsApi();
        const filteredOrgs = response.organizations.filter(org => 
          (org.type === 'team' || org.type === 'enterprise') &&
          org.name.toLowerCase().includes(query.toLowerCase())
        );
        setSearchResults(filteredOrgs);
      } catch (error) {
        console.error('Failed to search organizations:', error);
        toast.error('Failed to search organizations');
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    searchOrganizations(searchQuery);
  }, [searchQuery, searchOrganizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsSubmitting(true);
    try {
      // Send invitations for each selected organization
      for (const org of selectedOrgs) {
        await createInvitationApi({
          email,
          organization_id: org.id
        });
      }
      
      // If no organizations selected, send a general invitation
      if (selectedOrgs.length === 0) {
        await createInvitationApi({ email });
      }

      toast.success('Invitation(s) sent successfully');
      onInvited();
      onClose();
      setEmail('');
      setSelectedOrgs([]);
      setSearchQuery('');
    } catch (error) {
      toast.error('Failed to send invitation');
      console.error('Invitation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addOrganization = (org: Organization) => {
    if (!selectedOrgs.find(o => o.id === org.id)) {
      setSelectedOrgs(prev => [...prev, org]);
    }
    setSearchQuery(''); // Clear search after selection
  };

  const removeOrganization = (orgId: string) => {
    setSelectedOrgs(prev => prev.filter(org => org.id !== orgId));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invite User</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Add to Organizations (Optional)
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search organizations..."
              />
              
              {/* Search Results */}
              {searchQuery && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md">
                  {isSearching ? (
                    <div className="p-2 text-gray-500">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y">
                      {searchResults.map(org => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => addOrganization(org)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span>{org.name}</span>
                          <span className="text-sm text-gray-500">{org.type}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 text-gray-500">No organizations found</div>
                  )}
                </div>
              )}

              {/* Selected Organizations */}
              {selectedOrgs.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Organizations:</h4>
                  <div className="space-y-2">
                    {selectedOrgs.map(org => (
                      <div key={org.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                        <span>{org.name}</span>
                        <button
                          type="button"
                          onClick={() => removeOrganization(org.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            type="submit"
            variant="contained" 
            disabled={isSubmitting || !email}
          >
            {isSubmitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InviteUserModal; 